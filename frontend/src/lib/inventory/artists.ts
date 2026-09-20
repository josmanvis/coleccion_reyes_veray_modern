/**
 * Artist-name reconciliation.
 *
 * The source spreadsheet was typed by hand over many years, so the same artist
 * appears as "tavarez / andres", "Tavárez / Andrés" and "Tavarez / AndREs".
 * Every one of those is a separate row in `GROUP BY artist_last, artist_first`,
 * which inflates the artist count on /admin and splits the filter on /inventory.
 *
 * Nothing here rewrites data. It only reports which spellings collapse onto the
 * same accent- and case-insensitive key; picking the winner is the owner's call,
 * because only they know whether the accent belongs there.
 */

import { getDb, updateArtwork } from "./db";
import { normalizeText } from "./fields";

export type ArtistVariant = {
  /** Exactly as stored, including the accents and casing that make it a variant. */
  artist_last: string;
  artist_first: string | null;
  count: number;
};

export type ArtistGroup = {
  /** "apellido|nombre", accent- and case-folded. */
  key: string;
  lastKey: string;
  firstKey: string;
  variants: ArtistVariant[];
  total: number;
};

export type SurnameVariant = {
  artist_last: string;
  count: number;
  /** The first names filed under this exact spelling, for context. */
  firsts: string[];
};

export type SurnameGroup = {
  key: string;
  variants: SurnameVariant[];
  total: number;
};

export type SuggestionReason = "espaciado" | "orden" | "compuesto" | "similar" | "inicial";

export type Suggestion = {
  id: string;
  reason: SuggestionReason;
  sides: [ArtistGroup, ArtistGroup];
  variants: ArtistVariant[];
  total: number;
};

export const SUGGESTION_LABELS: Record<SuggestionReason, string> = {
  espaciado: "Difieren solo en espacios o puntuación",
  orden: "Mismos apellidos en distinto orden",
  compuesto: "Apellido simple frente a apellido compuesto",
  similar: "Se escriben casi igual (una letra de diferencia)",
  inicial: "Un nombre es la inicial del otro",
};

function keyOf(last: string, first: string | null): string {
  return `${normalizeText(last)}|${normalizeText(first ?? "")}`;
}

/** Sort by how many works use the spelling, then alphabetically, so ties are stable. */
function byUse(a: { count: number }, b: { count: number }, aLabel: string, bLabel: string) {
  return b.count - a.count || aLabel.localeCompare(bLabel, "es");
}

type RawPair = { artist_last: string; artist_first: string | null; count: number };

function rawPairs(): RawPair[] {
  return getDb()
    .prepare(
      `SELECT artist_last, artist_first, COUNT(*) AS count
         FROM artworks
        WHERE artist_last IS NOT NULL AND TRIM(artist_last) != ''
        GROUP BY artist_last, artist_first`
    )
    .all() as RawPair[];
}

/** Every artist, grouped by normalized apellido + nombre — including the clean ones. */
export function allArtistGroups(): ArtistGroup[] {
  const groups = new Map<string, ArtistGroup>();

  for (const pair of rawPairs()) {
    const lastKey = normalizeText(pair.artist_last);
    const firstKey = normalizeText(pair.artist_first ?? "");
    const key = `${lastKey}|${firstKey}`;

    let group = groups.get(key);
    if (!group) {
      group = { key, lastKey, firstKey, variants: [], total: 0 };
      groups.set(key, group);
    }
    group.variants.push(pair);
    group.total += pair.count;
  }

  for (const group of groups.values()) {
    group.variants.sort((a, b) =>
      byUse(a, b, `${a.artist_last} ${a.artist_first ?? ""}`, `${b.artist_last} ${b.artist_first ?? ""}`)
    );
  }

  return [...groups.values()];
}

/** The confirmed duplicates: one artist written more than one way. */
export function duplicateArtistGroups(): ArtistGroup[] {
  return allArtistGroups()
    .filter((g) => g.variants.length > 1)
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key, "es"));
}

/**
 * Surnames spelled more than one way, even when the first names differ.
 * "ruíz" (11 obras) and "ruiz" (8) are four different artists, but the filter on
 * /inventory keys on `artist_last`, so it lists the apellido twice.
 */
export function duplicateSurnameGroups(): SurnameGroup[] {
  const groups = new Map<string, Map<string, SurnameVariant>>();

  for (const pair of rawPairs()) {
    const key = normalizeText(pair.artist_last);
    let variants = groups.get(key);
    if (!variants) {
      variants = new Map();
      groups.set(key, variants);
    }
    const variant = variants.get(pair.artist_last) ?? {
      artist_last: pair.artist_last,
      count: 0,
      firsts: [],
    };
    variant.count += pair.count;
    if (pair.artist_first && !variant.firsts.includes(pair.artist_first)) {
      variant.firsts.push(pair.artist_first);
    }
    variants.set(pair.artist_last, variant);
  }

  return [...groups.entries()]
    .filter(([, variants]) => variants.size > 1)
    .map(([key, variants]) => {
      const list = [...variants.values()].sort((a, b) => byUse(a, b, a.artist_last, b.artist_last));
      return { key, variants: list, total: list.reduce((sum, v) => sum + v.count, 0) };
    })
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key, "es"));
}

function squash(value: string): string {
  return value.replace(/[^a-z0-9]/g, "");
}

function words(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

/** Bounded edit distance — returns `limit + 1` as soon as it is clearly further. */
function editDistance(a: string, b: string, limit = 1): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      best = Math.min(best, current[j]);
    }
    if (best > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

function startsWithWords(longer: string[], shorter: string[]): boolean {
  if (shorter.length === 0 || shorter.length >= longer.length) return false;
  return shorter.every((word, i) => longer[i] === word);
}

function sameWordSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length || a.length < 2) return false;
  const sortedA = [...a].sort().join(" ");
  const sortedB = [...b].sort().join(" ");
  return sortedA === sortedB;
}

function isInitialOf(short: string, long: string): boolean {
  const trimmed = short.replace(/\./g, "").trim();
  return trimmed.length === 1 && long.length > 1 && long.startsWith(trimmed);
}

/**
 * Pairs that look related but are not the same key — Díaz vs Díaz Beltrán, Marín
 * vs Martín. These are guesses, not duplicates: two people really can share an
 * apellido. A same-name requirement keeps the list short enough to read.
 */
function reasonFor(a: ArtistGroup, b: ArtistGroup): SuggestionReason | null {
  const sameFirst = a.firstKey === b.firstKey && a.firstKey !== "";
  const sameLast = a.lastKey === b.lastKey;

  if (squash(a.key) === squash(b.key)) return "espaciado";

  if (sameLast && (isInitialOf(a.firstKey, b.firstKey) || isInitialOf(b.firstKey, a.firstKey))) {
    return "inicial";
  }

  if (!sameFirst || sameLast) return null;

  const wordsA = words(a.lastKey);
  const wordsB = words(b.lastKey);

  if (sameWordSet(wordsA, wordsB)) return "orden";
  if (startsWithWords(wordsA, wordsB) || startsWithWords(wordsB, wordsA)) return "compuesto";
  if (a.lastKey.length >= 4 && b.lastKey.length >= 4 && editDistance(a.lastKey, b.lastKey) === 1) {
    return "similar";
  }

  return null;
}

export function artistSuggestions(): Suggestion[] {
  const groups = allArtistGroups();
  const suggestions: Suggestion[] = [];

  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const reason = reasonFor(groups[i], groups[j]);
      if (!reason) continue;

      const sides: [ArtistGroup, ArtistGroup] =
        groups[i].total >= groups[j].total ? [groups[i], groups[j]] : [groups[j], groups[i]];
      const variants = [...sides[0].variants, ...sides[1].variants].sort((a, b) =>
        byUse(a, b, `${a.artist_last} ${a.artist_first ?? ""}`, `${b.artist_last} ${b.artist_first ?? ""}`)
      );

      suggestions.push({
        id: `${sides[0].key}::${sides[1].key}`,
        reason,
        sides,
        variants,
        total: sides[0].total + sides[1].total,
      });
    }
  }

  return suggestions.sort((a, b) => b.total - a.total || a.id.localeCompare(b.id, "es"));
}

export function artistReview() {
  const all = allArtistGroups();
  return {
    duplicates: duplicateArtistGroups(),
    surnames: duplicateSurnameGroups(),
    suggestions: artistSuggestions(),
    /** What the artist count would drop to once every duplicate group is unified. */
    distinctKeys: all.length,
    rawPairs: all.reduce((sum, g) => sum + g.variants.length, 0),
  };
}

export { keyOf };

// --- Applying a decision -----------------------------------------------------

export type MergeScope = "full" | "surname";

export type MergeVariant = { artist_last: string; artist_first?: string | null };

export type MergeRequest = {
  scope: MergeScope;
  /** The exact spellings being replaced, as shown in the review screen. */
  variants: MergeVariant[];
  /** Which of those spellings the owner chose to keep. */
  canonical: MergeVariant;
};

/** Guards against a request that would rewrite half the collection in one call. */
const MAX_VARIANTS = 60;

function sameVariant(a: MergeVariant, b: MergeVariant, scope: MergeScope): boolean {
  if (a.artist_last !== b.artist_last) return false;
  if (scope === "surname") return true;
  return (a.artist_first ?? "") === (b.artist_first ?? "");
}

/**
 * Rewrites the chosen spelling onto every row that uses one of the other ones.
 * Rows are matched on their exact stored values, so the caller can only touch
 * names it already named. Goes through `updateArtwork`, which recomputes
 * `search_blob` and `status_group`.
 */
export function applyCanonicalArtist(request: MergeRequest) {
  const { scope, canonical } = request;

  if (scope !== "full" && scope !== "surname") {
    throw new Error("Ámbito inválido");
  }
  if (!Array.isArray(request.variants) || request.variants.length < 2) {
    throw new Error("Hacen falta al menos dos grafías para unificar");
  }
  if (request.variants.length > MAX_VARIANTS) {
    throw new Error("Demasiadas grafías en una sola operación");
  }
  if (!canonical?.artist_last?.trim()) {
    throw new Error("Falta la grafía correcta");
  }
  if (!request.variants.some((v) => sameVariant(v, canonical, scope))) {
    throw new Error("La grafía correcta debe ser una de las listadas");
  }

  const db = getDb();
  const losers = request.variants.filter((v) => !sameVariant(v, canonical, scope));

  // Keyed on `ref`, not `registro`: a few portfolios share a registro number, and
  // updating by registro would only reach the first row of the set.
  const refs: string[] = [];
  for (const variant of losers) {
    if (!variant.artist_last?.trim()) continue;
    const rows =
      scope === "surname"
        ? (db
            .prepare("SELECT ref FROM artworks WHERE artist_last IS @last")
            .all({ last: variant.artist_last }) as Array<{ ref: string }>)
        : (db
            .prepare(
              "SELECT ref FROM artworks WHERE artist_last IS @last AND artist_first IS @first"
            )
            .all({
              last: variant.artist_last,
              first: variant.artist_first ?? null,
            }) as Array<{ ref: string }>);
    for (const row of rows) refs.push(row.ref);
  }

  const patch: Record<string, string> =
    scope === "surname"
      ? { artist_last: canonical.artist_last }
      : { artist_last: canonical.artist_last, artist_first: canonical.artist_first ?? "" };

  const unique = [...new Set(refs)];
  db.transaction(() => {
    for (const ref of unique) updateArtwork(ref, patch);
  })();

  return { updated: unique.length, refs: unique };
}
