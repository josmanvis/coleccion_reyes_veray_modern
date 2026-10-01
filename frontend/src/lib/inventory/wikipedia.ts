/**
 * Looking an artist up on Wikipedia.
 *
 * Nothing here writes to the collection's own records. What comes back is
 * stored in its own columns, shown in its own tab, and credited to Wikipedia —
 * the catalogue is the authority on these works, and an encyclopedia edited by
 * anyone is not allowed to quietly overwrite it. Dates and gender arrive as
 * *suggestions* the owner accepts one at a time.
 *
 * Spanish first, English as a fallback: most of the collection is Puerto Rican
 * and Caribbean, and the Spanish article is usually the fuller one.
 */

const LANGS = ["es", "en"] as const;
export type WikiLang = (typeof LANGS)[number];

/**
 * Wikimedia asks for a descriptive User-Agent and rate-limits anonymous
 * traffic that does not send one.
 */
const AGENT = "CRVMGMT/1.0 (Coleccion Reyes-Veray inventory; contact via collection)";
const TIMEOUT = 12_000;

async function wikiFetch(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    // Offline, blocked, or slow: the tab simply says nothing was found.
    return null;
  }
}

export type WikiCandidate = {
  lang: WikiLang;
  title: string;
  description: string;
  snippet: string;
};

/** Plain text from the HTML snippet the search API returns. */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export async function searchArtist(name: string): Promise<WikiCandidate[]> {
  const query = name.trim();
  if (query.length < 3) return [];

  const found: WikiCandidate[] = [];
  for (const lang of LANGS) {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`;
    const data = (await wikiFetch(url)) as
      | { query?: { search?: Array<{ title: string; snippet: string }> } }
      | null;

    for (const hit of data?.query?.search ?? []) {
      found.push({
        lang,
        title: hit.title,
        description: "",
        snippet: stripTags(hit.snippet ?? ""),
      });
    }
    // A good Spanish match makes the English search unnecessary.
    if (found.length >= 3) break;
  }
  return found.slice(0, 8);
}

export type WikiSuggestions = {
  birthDate: string | null;
  deathDate: string | null;
  gender: string | null;
  nationality: string | null;
};

export type WikiArticle = {
  lang: WikiLang;
  title: string;
  description: string;
  extract: string;
  url: string;
  thumbnail: string | null;
  wikidataId: string | null;
  suggestions: WikiSuggestions;
  fetchedAt: string;
};

/** Wikidata's identifiers for sex or gender (P21), mapped to our own values. */
const GENDER_BY_QID: Record<string, string> = {
  Q6581097: "masculino",
  Q6581072: "femenino",
  Q1097630: "intersexual",
  Q48270: "no binario",
  Q1052281: "femenino",
  Q2449503: "masculino",
};

function claimTime(entity: Record<string, never>, property: string): string | null {
  const claims = (entity as { claims?: Record<string, unknown[]> })?.claims?.[property];
  const snak = (
    claims?.[0] as {
      mainsnak?: { datavalue?: { value?: { time?: string; precision?: number } } };
    }
  )?.mainsnak?.datavalue?.value;

  const value = snak?.time;
  if (!value) return null;

  const match = value.match(/^[+-](\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;

  // Wikidata always fills the whole date and says how much of it to believe:
  // 11 is a day, 10 a month, 9 a year or vaguer. A year-only birth is stored
  // as the 1st of January, so copying it verbatim would invent a birthday.
  const precision = snak?.precision ?? 11;
  if (precision <= 9) return year;
  if (precision === 10) return month === "00" ? year : `${year}-${month}`;
  if (month === "00") return year;
  if (day === "00") return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function claimId(entity: Record<string, never>, property: string): string | null {
  const claims = (entity as { claims?: Record<string, unknown[]> })?.claims?.[property];
  return (
    (claims?.[0] as { mainsnak?: { datavalue?: { value?: { id?: string } } } })?.mainsnak?.datavalue
      ?.value?.id ?? null
  );
}

async function labelFor(qid: string): Promise<string | null> {
  const data = (await wikiFetch(
    `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`
  )) as { entities?: Record<string, { labels?: Record<string, { value?: string }> }> } | null;
  const labels = data?.entities?.[qid]?.labels;
  return labels?.es?.value ?? labels?.en?.value ?? null;
}

/**
 * The article plus whatever Wikidata knows about the person. Wikidata is used
 * for the dates and gender rather than parsing the prose, because those are
 * stored there as data rather than as a sentence.
 */
export async function fetchArticle(lang: WikiLang, title: string): Promise<WikiArticle | null> {
  const summary = (await wikiFetch(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  )) as {
    title?: string;
    description?: string;
    extract?: string;
    type?: string;
    content_urls?: { desktop?: { page?: string } };
    thumbnail?: { source?: string };
    wikibase_item?: string;
  } | null;

  if (!summary?.extract) return null;
  // A disambiguation page is a list of people, not a person.
  if (summary.type === "disambiguation") return null;

  const wikidataId = summary.wikibase_item ?? null;
  const suggestions: WikiSuggestions = {
    birthDate: null,
    deathDate: null,
    gender: null,
    nationality: null,
  };

  if (wikidataId) {
    const data = (await wikiFetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`
    )) as { entities?: Record<string, Record<string, never>> } | null;
    const entity = data?.entities?.[wikidataId];

    if (entity) {
      suggestions.birthDate = claimTime(entity, "P569");
      suggestions.deathDate = claimTime(entity, "P570");

      const genderId = claimId(entity, "P21");
      suggestions.gender = genderId ? (GENDER_BY_QID[genderId] ?? null) : null;

      const countryId = claimId(entity, "P27");
      suggestions.nationality = countryId ? await labelFor(countryId) : null;
    }
  }

  return {
    lang,
    title: summary.title ?? title,
    description: summary.description ?? "",
    extract: summary.extract,
    url: summary.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${title}`,
    thumbnail: summary.thumbnail?.source ?? null,
    wikidataId,
    suggestions,
    fetchedAt: new Date().toISOString(),
  };
}
