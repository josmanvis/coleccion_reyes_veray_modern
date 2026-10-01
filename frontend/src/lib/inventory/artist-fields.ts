/**
 * The artist profile's shape and vocabulary, with no database behind it.
 *
 * Split out from `artist-profile.ts` because the artist screens are client
 * components: importing a *value* from a module that reaches better-sqlite3
 * pulls the native binding into the browser bundle and the build fails with an
 * unrelated-looking ENOENT. See project-client-server-module-split.
 */

/** The values the gender field accepts, and how they read on screen. */
export const GENDERS = [
  { value: "", label: "Sin especificar" },
  { value: "femenino", label: "Femenino" },
  { value: "masculino", label: "Masculino" },
  { value: "no binario", label: "No binario" },
  { value: "intersexual", label: "Intersexual" },
  { value: "otro", label: "Otro" },
] as const;

export const GENDER_VALUES: readonly string[] = GENDERS.map((g) => g.value);

export type WikiCache = {
  lang: string;
  title: string;
  description: string;
  extract: string;
  url: string;
  thumbnail: string;
  id: string;
  suggestions: {
    birthDate: string | null;
    deathDate: string | null;
    gender: string | null;
    nationality: string | null;
  };
  fetchedAt: string;
};

export type ArtistProfile = {
  slug: string;
  artist_last: string;
  artist_first: string;
  gender: string;
  birth_date: string;
  death_date: string;
  nationality: string;
  notes: string;
  /** Null until someone links an article; never merged into the fields above. */
  wiki: WikiCache | null;
  updated_at: string;
};

/** A year, a year and month, or a full date — a catalogue often knows only one. */
export const PARTIAL_DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

/** "1938–2004", or "n. 1938" for someone living. */
export function lifespan(profile: Pick<ArtistProfile, "birth_date" | "death_date">): string {
  const birth = profile.birth_date.slice(0, 4);
  const death = profile.death_date.slice(0, 4);
  if (birth && death) return `${birth}–${death}`;
  if (birth) return `n. ${birth}`;
  if (death) return `†${death}`;
  return "";
}
