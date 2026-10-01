import { getDb } from "./db";
import type { WikiArticle } from "./wikipedia";
import { GENDER_VALUES, PARTIAL_DATE, type ArtistProfile } from "./artist-fields";

export type { ArtistProfile } from "./artist-fields";
export { GENDERS, lifespan } from "./artist-fields";

/**
 * Everything about an artist that is not derived from their works.
 *
 * The works table holds only the names as catalogued. Biographical facts —
 * when someone was born, when they died, their gender — belong to the person,
 * not to a painting, so they live here, one row per artist.
 *
 * Two kinds of field, kept strictly apart:
 *
 * - The owner's own: `gender`, `birth_date`, `death_date`, `nationality`,
 *   `notes`. These are the collection's record and nothing writes them except
 *   a person choosing to.
 * - The Wikipedia cache: every `wiki_*` column. Refetched on demand, shown in
 *   its own tab, credited, and never copied into the columns above unless
 *   someone presses the button that does exactly that.
 *
 * That separation is the whole design: an encyclopedia anyone can edit may
 * inform the catalogue, but it may not become it.
 */

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS artist_profiles (
  slug TEXT PRIMARY KEY,
  artist_last TEXT NOT NULL DEFAULT '',
  artist_first TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT '',
  birth_date TEXT NOT NULL DEFAULT '',
  death_date TEXT NOT NULL DEFAULT '',
  nationality TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  wiki_lang TEXT NOT NULL DEFAULT '',
  wiki_title TEXT NOT NULL DEFAULT '',
  wiki_description TEXT NOT NULL DEFAULT '',
  wiki_extract TEXT NOT NULL DEFAULT '',
  wiki_url TEXT NOT NULL DEFAULT '',
  wiki_thumbnail TEXT NOT NULL DEFAULT '',
  wiki_id TEXT NOT NULL DEFAULT '',
  wiki_suggestions TEXT NOT NULL DEFAULT '{}',
  wiki_fetched_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_artist_profiles_last ON artist_profiles(artist_last);
`;

let ready = false;

function db() {
  const handle = getDb();
  if (!ready) {
    handle.exec(CREATE_SQL);
    ready = true;
  }
  return handle;
}

const EMPTY_SUGGESTIONS = { birthDate: null, deathDate: null, gender: null, nationality: null };

function hydrate(row: Record<string, unknown>): ArtistProfile {
  const text = (key: string) => String(row[key] ?? "");
  const hasWiki = text("wiki_title").length > 0;

  return {
    slug: text("slug"),
    artist_last: text("artist_last"),
    artist_first: text("artist_first"),
    gender: text("gender"),
    birth_date: text("birth_date"),
    death_date: text("death_date"),
    nationality: text("nationality"),
    notes: text("notes"),
    wiki: hasWiki
      ? {
          lang: text("wiki_lang"),
          title: text("wiki_title"),
          description: text("wiki_description"),
          extract: text("wiki_extract"),
          url: text("wiki_url"),
          thumbnail: text("wiki_thumbnail"),
          id: text("wiki_id"),
          suggestions: (() => {
            try {
              return { ...EMPTY_SUGGESTIONS, ...JSON.parse(text("wiki_suggestions") || "{}") };
            } catch {
              return EMPTY_SUGGESTIONS;
            }
          })(),
          fetchedAt: text("wiki_fetched_at"),
        }
      : null,
    updated_at: text("updated_at"),
  };
}

/** An absent profile reads as an empty one, so callers never branch on null. */
export function getProfile(slug: string): ArtistProfile {
  const row = db().prepare("SELECT * FROM artist_profiles WHERE slug = ?").get(slug) as
    | Record<string, unknown>
    | undefined;
  return row
    ? hydrate(row)
    : hydrate({ slug, wiki_suggestions: "{}", updated_at: "" });
}

function ensure(slug: string, names: { last?: string; first?: string } = {}) {
  db()
    .prepare(
      `INSERT INTO artist_profiles (slug, artist_last, artist_first)
       VALUES (@slug, @last, @first)
       ON CONFLICT(slug) DO NOTHING`
    )
    .run({ slug, last: names.last ?? "", first: names.first ?? "" });
}

/** Only the owner's own fields. The Wikipedia cache is untouched. */
export function saveProfile(
  slug: string,
  patch: Partial<Pick<ArtistProfile, "gender" | "birth_date" | "death_date" | "nationality" | "notes">>,
  names: { last?: string; first?: string } = {}
): ArtistProfile {
  ensure(slug, names);

  if (patch.gender !== undefined && !GENDER_VALUES.includes(patch.gender)) {
    throw new Error("Valor de género no válido");
  }
  for (const key of ["birth_date", "death_date"] as const) {
    const value = patch[key];
    if (value && !PARTIAL_DATE.test(value)) {
      throw new Error("Las fechas van como AAAA, AAAA-MM o AAAA-MM-DD");
    }
  }
  // Compared against what is already stored, not just against the other half
  // of this edit: setting a death date alone still has to make sense next to
  // the birth date already on the record.
  const current = getProfile(slug);
  const birth = patch.birth_date ?? current.birth_date;
  const death = patch.death_date ?? current.death_date;
  if (birth && death && death.slice(0, 4) < birth.slice(0, 4)) {
    throw new Error("La fecha de defunción es anterior a la de nacimiento");
  }

  const fields = (["gender", "birth_date", "death_date", "nationality", "notes"] as const).filter(
    (key) => patch[key] !== undefined
  );
  if (fields.length > 0) {
    db()
      .prepare(
        `UPDATE artist_profiles
            SET ${fields.map((f) => `${f} = @${f}`).join(", ")}, updated_at = datetime('now')
          WHERE slug = @slug`
      )
      .run({ slug, ...Object.fromEntries(fields.map((f) => [f, String(patch[f] ?? "")])) });
  }

  return getProfile(slug);
}

/** Stores a fetched article. Writes only `wiki_*` columns, by construction. */
export function saveArticle(
  slug: string,
  article: WikiArticle | null,
  names: { last?: string; first?: string } = {}
): ArtistProfile {
  ensure(slug, names);

  db()
    .prepare(
      `UPDATE artist_profiles SET
         wiki_lang = @lang, wiki_title = @title, wiki_description = @description,
         wiki_extract = @extract, wiki_url = @url, wiki_thumbnail = @thumbnail,
         wiki_id = @id, wiki_suggestions = @suggestions, wiki_fetched_at = @fetchedAt,
         updated_at = datetime('now')
       WHERE slug = @slug`
    )
    .run({
      slug,
      lang: article?.lang ?? "",
      title: article?.title ?? "",
      description: article?.description ?? "",
      extract: article?.extract ?? "",
      url: article?.url ?? "",
      thumbnail: article?.thumbnail ?? "",
      id: article?.wikidataId ?? "",
      suggestions: JSON.stringify(article?.suggestions ?? EMPTY_SUGGESTIONS),
      fetchedAt: article?.fetchedAt ?? "",
    });

  return getProfile(slug);
}

/** Profiles that carry any owner-entered fact, for the artists overview. */
export function profilesBySlug(): Map<string, ArtistProfile> {
  const rows = db().prepare("SELECT * FROM artist_profiles").all() as Array<
    Record<string, unknown>
  >;
  return new Map(rows.map((row) => [String(row.slug), hydrate(row)]));
}

