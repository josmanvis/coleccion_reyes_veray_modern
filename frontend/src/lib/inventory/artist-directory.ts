import { getDb } from "./db";
import { listArtists, artistKey } from "./public";
import { profilesBySlug } from "./artist-profile";
import { isForSale, normalizeText } from "./fields";
import { knownCities, parsePlace } from "./birthplace";

/**
 * Every artist in the collection with the facts that can be sorted and
 * filtered on: life dates, birthplace, gender and what the collection holds.
 *
 * Two sources, and the owner's always wins. The artist profile holds what
 * someone entered for the person; the works carry the spreadsheet's per-row
 * copies of birth year and place, which disagree now and then, so the value
 * most rows agree on is taken.
 */

export type LifeStatus = "fallecido" | "sin_defuncion" | "sin_datos";

export type DirectoryArtist = {
  slug: string;
  name: string;
  artist_last: string;
  artist_first: string;
  gender: string;
  nationality: string;
  birthYear: number | null;
  deathYear: number | null;
  /** As typed in the spreadsheet. */
  birthPlace: string;
  /** Read out of `birthPlace` for filtering: "San Juan, PR" -> San Juan / — / Puerto Rico. */
  birthCity: string;
  birthState: string;
  birthCountry: string;
  deathPlace: string;
  life: LifeStatus;
  works: number;
  inInventory: number;
  forSale: number;
  value: number;
  hasBio: boolean;
};

export const LIFE_LABELS: Record<LifeStatus, string> = {
  fallecido: "Fallecido",
  // Not "vivo": a missing date only means none is on file.
  sin_defuncion: "Vivo o sin fecha de defunción",
  sin_datos: "Sin fechas",
};

export const DIRECTORY_SORTS = [
  "name",
  "works",
  "value",
  "birth",
  "death",
  "city",
  "state",
  "country",
  "gender",
] as const;
export type DirectorySort = (typeof DIRECTORY_SORTS)[number];

export type DirectoryFilters = {
  q?: string;
  gender?: string;
  city?: string;
  state?: string;
  country?: string;
  life?: string;
  bornMin?: number;
  bornMax?: number;
  /** "birth" | "gender" | "place" | "city" — artists missing that fact. */
  missing?: string;
  forSale?: boolean;
  sort?: string;
  dir?: "asc" | "desc";
};

function mostCommon<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN) [best, bestN] = [v, n];
  return best;
}

function yearOf(date: string): number | null {
  const match = date.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

export function artistDirectory(): DirectoryArtist[] {
  const rows = getDb()
    .prepare(
      `SELECT artist_last, artist_first, artist_birth_year, artist_death_year,
              artist_birth_place, artist_death_place, biography, current_value,
              sales, status_group
         FROM artworks
        WHERE artist_last IS NOT NULL AND TRIM(artist_last) != ''`
    )
    .all() as Array<Record<string, string | number | null>>;

  const byKey = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = artistKey(row);
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }

  const profiles = profilesBySlug();
  const cities = knownCities(rows.map((r) => String(r.artist_birth_place ?? "")));

  return listArtists().map((artist) => {
    const works = byKey.get(artistKey(artist as unknown as Record<string, unknown>)) ?? [];
    const profile = profiles.get(artist.slug);
    const nums = (key: string) => works.map((w) => w[key]).filter((v): v is number => typeof v === "number");
    const texts = (key: string) =>
      works.map((w) => String(w[key] ?? "").trim()).filter((v) => v && v !== "-");

    const birthYear = (profile && yearOf(profile.birth_date)) ?? mostCommon(nums("artist_birth_year"));
    const deathYear = (profile && yearOf(profile.death_date)) ?? mostCommon(nums("artist_death_year"));
    const birthPlace = mostCommon(texts("artist_birth_place")) ?? "";
    const place = parsePlace(birthPlace, cities);

    return {
      slug: artist.slug,
      name: artist.name,
      artist_last: artist.artist_last,
      artist_first: artist.artist_first ?? "",
      gender: profile?.gender ?? "",
      nationality: profile?.nationality ?? "",
      birthYear,
      deathYear,
      birthPlace,
      birthCity: place.city,
      birthState: place.state,
      birthCountry: place.country,
      deathPlace: mostCommon(texts("artist_death_place")) ?? "",
      life: deathYear || profile?.death_date ? "fallecido" : birthYear ? "sin_defuncion" : "sin_datos",
      works: works.length,
      inInventory: works.filter((w) => w.status_group === "en_inventario").length,
      forSale: works.filter((w) => isForSale(w.sales)).length,
      value: nums("current_value").reduce((a, b) => a + b, 0),
      hasBio: Boolean(artist.bio),
    };
  });
}

/**
 * Counted options for the filter dropdowns, most common first. States narrow
 * to the chosen country and cities to the chosen country and state, so the
 * lists stay short.
 */
export function directoryFacets(artists: DirectoryArtist[], within: { country?: string; state?: string } = {}) {
  const inCountry = (a: DirectoryArtist) => !within.country || a.birthCountry === within.country;
  const inState = (a: DirectoryArtist) => inCountry(a) && (!within.state || a.birthState === within.state);
  const count = (pick: (a: DirectoryArtist) => string, keep: (a: DirectoryArtist) => boolean = () => true) => {
    const counts = new Map<string, number>();
    for (const a of artists) {
      if (!keep(a)) continue;
      const v = pick(a);
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "es"));
  };
  return {
    gender: count((a) => a.gender),
    country: count((a) => a.birthCountry),
    state: count((a) => a.birthState, inCountry),
    city: count((a) => a.birthCity, inState),
    life: count((a) => a.life),
  };
}

export function filterDirectory(artists: DirectoryArtist[], f: DirectoryFilters): DirectoryArtist[] {
  const words = normalizeText(f.q ?? "").split(/\s+/).filter(Boolean);
  const list = artists.filter((a) => {
    if (words.length) {
      const hay = normalizeText(`${a.name} ${a.birthPlace} ${a.birthCity} ${a.birthState} ${a.birthCountry} ${a.nationality}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    if (f.gender && (f.gender === "_none" ? a.gender : a.gender !== f.gender)) return false;
    if (f.country && a.birthCountry !== f.country) return false;
    if (f.state && a.birthState !== f.state) return false;
    if (f.city && a.birthCity !== f.city) return false;
    if (f.life && a.life !== f.life) return false;
    if (f.bornMin !== undefined && (a.birthYear === null || a.birthYear < f.bornMin)) return false;
    if (f.bornMax !== undefined && (a.birthYear === null || a.birthYear > f.bornMax)) return false;
    if (f.missing === "birth" && a.birthYear !== null) return false;
    if (f.missing === "gender" && a.gender) return false;
    if (f.missing === "place" && a.birthPlace) return false;
    if (f.missing === "city" && (a.birthCity || !a.birthPlace)) return false;
    if (f.forSale && a.forSale === 0) return false;
    return true;
  });

  const sort = (DIRECTORY_SORTS as readonly string[]).includes(f.sort ?? "") ? (f.sort as DirectorySort) : "name";
  const sign = f.dir === "desc" ? -1 : 1;
  const byName = (a: DirectoryArtist, b: DirectoryArtist) =>
    normalizeText(a.artist_last).localeCompare(normalizeText(b.artist_last), "es") ||
    normalizeText(a.artist_first).localeCompare(normalizeText(b.artist_first), "es");
  // Blanks always sink to the bottom, whichever way the column is sorted.
  const blanksLast = <T,>(x: T | null | "", y: T | null | "", cmp: (x: T, y: T) => number) => {
    const ex = x === null || x === "";
    const ey = y === null || y === "";
    if (ex || ey) return ex === ey ? 0 : ex ? 1 : -1;
    return sign * cmp(x as T, y as T);
  };
  const num = (x: number, y: number) => x - y;
  const str = (x: string, y: string) => x.localeCompare(y, "es");

  return list.sort((a, b) => {
    let d = 0;
    if (sort === "name") d = sign * byName(a, b);
    else if (sort === "works") d = sign * (a.works - b.works);
    else if (sort === "value") d = sign * (a.value - b.value);
    else if (sort === "birth") d = blanksLast(a.birthYear, b.birthYear, num);
    else if (sort === "death") d = blanksLast(a.deathYear, b.deathYear, num);
    else if (sort === "city") d = blanksLast(a.birthCity, b.birthCity, str);
    else if (sort === "state") d = blanksLast(a.birthState, b.birthState, str);
    else if (sort === "country") d = blanksLast(a.birthCountry, b.birthCountry, str);
    else if (sort === "gender") d = blanksLast(a.gender, b.gender, str);
    return d || byName(a, b);
  });
}
