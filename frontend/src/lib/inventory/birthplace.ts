import { normalizeText } from "./fields";

/**
 * Splits a free-text birthplace into city, state and country.
 *
 * The spreadsheet writes places a dozen ways: "San Juan, PR", "Bayamón",
 * "Bronx, Nueva York, EEUU", "Chicago, IL", "Galicia, España", "Venezuela".
 * This reads them for grouping and filtering only; the birthplace itself is
 * shown and stored exactly as typed.
 *
 * Puerto Rico is a country here, not a US state, as the collection files it.
 * No imports beyond `fields` so it stays usable anywhere.
 */

export type Place = { city: string; state: string; country: string };

const US = "Estados Unidos";

const COUNTRY_ALIASES: Record<string, string> = {
  pr: "Puerto Rico",
  "p.r.": "Puerto Rico",
  "puerto rico": "Puerto Rico",
  eeuu: US,
  "ee.uu.": US,
  "ee. uu.": US,
  usa: US,
  "estados unidos": US,
  rd: "República Dominicana",
  "republica dominicana": "República Dominicana",
  france: "Francia",
  venezuel: "Venezuela",
  humgria: "Hungría",
  japan: "Japón",
  holanda: "Países Bajos",
};

/** Countries that appear spelled out; anything else at the end is taken as a country too. */
const KNOWN_COUNTRIES = new Set(
  [
    "Puerto Rico", US, "Cuba", "México", "España", "Venezuela", "Argentina", "Colombia", "Perú", "Chile",
    "Uruguay", "Ecuador", "Panamá", "Guatemala", "Haití", "República Dominicana", "Francia", "Alemania",
    "Irlanda", "Suiza", "Suecia", "Hungría", "Ucrania", "Bielorrusia", "China", "Japón", "Australia",
    "Países Bajos", "Brasil", "Canadá", "Reino Unido", "Indonesia",
  ].map(normalizeText)
);

/** US states by code and by name, Spanish or English, to one spelling. */
const US_STATES: Record<string, string> = {
  ca: "California",
  california: "California",
  fl: "Florida",
  florida: "Florida",
  il: "Illinois",
  illinois: "Illinois",
  dc: "Distrito de Columbia",
  "d.c.": "Distrito de Columbia",
  ny: "Nueva York",
  "nueva york": "Nueva York",
  "new york": "Nueva York",
  nj: "Nueva Jersey",
  "nueva jersey": "Nueva Jersey",
  "new jersey": "Nueva Jersey",
  ma: "Massachusetts",
  massachusetts: "Massachusetts",
  sc: "Carolina del Sur",
  "south carolina": "Carolina del Sur",
  "carolina del sur": "Carolina del Sur",
  indiana: "Indiana",
  virginia: "Virginia",
  texas: "Texas",
  tx: "Texas",
  pennsylvania: "Pensilvania",
  pensilvania: "Pensilvania",
  pa: "Pensilvania",
  michigan: "Míchigan",
  mi: "Míchigan",
};

/** Regions, provinces and states outside the US written where a city would go. */
const REGIONS = new Set(
  [
    "Galicia", "Chiapas", "Coahuila", "Oriente", "Estado Anzoátegui", "Islas Canarias", "Gran Canarias",
    "Mallorca", "Tenerife", "Bali",
  ].map(normalizeText)
);

/** Cities written alone, with the state and country they belong to. */
const LONE_CITIES: Record<string, Place> = {
  "nueva york": { city: "Nueva York", state: "Nueva York", country: US },
  "new york": { city: "Nueva York", state: "Nueva York", country: US },
  vancouver: { city: "Vancouver", state: "Columbia Británica", country: "Canadá" },
  "sao paulo": { city: "São Paulo", state: "São Paulo", country: "Brasil" },
  castleford: { city: "Castleford", state: "Inglaterra", country: "Reino Unido" },
  "canal de panama": { city: "", state: "Canal de Panamá", country: "Panamá" },
  bali: { city: "", state: "Bali", country: "Indonesia" },
};

const CITY_ALIASES: Record<string, string> = {
  habana: "La Habana",
  carcas: "Caracas",
  "los angeles": "Los Ángeles",
};

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function country(value: string): string {
  const key = normalizeText(value);
  return COUNTRY_ALIASES[key] ?? value;
}

function isCountry(value: string): boolean {
  return KNOWN_COUNTRIES.has(normalizeText(country(value)));
}

function city(value: string): string {
  return CITY_ALIASES[normalizeText(value)] ?? value;
}

/**
 * Reads one birthplace. `known` holds cities seen elsewhere in full, so a bare
 * "Bayamón" gets its country and "Boston, EEUU" its state.
 */
export function parsePlace(raw: string, known: Map<string, Place> = new Map()): Place {
  const place = readPlace(raw, known);
  if (place.city && !place.state) {
    const seen = known.get(normalizeText(place.city));
    if (seen?.state && (!place.country || seen.country === place.country)) {
      return { ...place, state: seen.state, country: place.country || seen.country };
    }
  }
  return place;
}

function readPlace(raw: string, known: Map<string, Place>): Place {
  const empty = { city: "", state: "", country: "" };
  // "Filadelfia, EEUU; La Habana, Cuba" lists two; the first is the birthplace.
  // "Venezuela; Carcas" is country then city.
  const segments = raw.split(";").map(tidy).filter(Boolean);
  if (segments.length === 0) return empty;
  if (segments.length > 1 && !segments[0].includes(",") && isCountry(segments[0]) && !segments[1].includes(",")) {
    return { city: city(segments[1]), state: "", country: country(segments[0]) };
  }

  const parts = segments[0].split(",").map(tidy).filter(Boolean);
  if (parts.length === 0) return empty;

  if (parts.length === 1) {
    const only = parts[0];
    const key = normalizeText(only);
    if (LONE_CITIES[key]) return LONE_CITIES[key];
    if (isCountry(only)) return { city: "", state: "", country: country(only) };
    if (US_STATES[key]) return { city: "", state: US_STATES[key], country: US };
    const seen = known.get(key);
    if (seen) return { ...seen, city: seen.city || only };
    return { city: city(only), state: "", country: "" };
  }

  const last = parts[parts.length - 1];
  const lastKey = normalizeText(last);
  const head = parts.slice(0, -1);

  // "Chicago, IL", "Boston, Massachusetts": a US state where the country goes.
  if (US_STATES[lastKey] && !isCountry(last)) {
    return { city: city(head[0]), state: US_STATES[lastKey], country: US };
  }

  const nation = country(last);
  if (head.length >= 2) {
    // "Bronx, Nueva York, EEUU", "Tenerife, Islas Canarias, España".
    const middle = head[head.length - 1];
    return { city: city(head[0]), state: US_STATES[normalizeText(middle)] ?? middle, country: nation };
  }

  const first = head[0];
  const firstKey = normalizeText(first);
  // "Nueva York, EEUU" is the city far more often than the state.
  if (nation === US && LONE_CITIES[firstKey]) return LONE_CITIES[firstKey];
  if (nation === US && US_STATES[firstKey]) return { city: "", state: US_STATES[firstKey], country: US };
  if (REGIONS.has(firstKey)) return { city: "", state: first, country: nation };
  return { city: city(first), state: "", country: nation };
}

/** City -> place, from every birthplace that names a country, for resolving bare cities. */
export function knownCities(places: string[]): Map<string, Place> {
  const index = new Map<string, Place>();
  for (const raw of places) {
    if (!raw.includes(",")) continue;
    const place = readPlace(raw, new Map());
    if (!place.city || !place.country) continue;
    const key = normalizeText(place.city);
    // Keep the fullest spelling: "Boston, Massachusetts" over "Boston, EEUU".
    if (!index.get(key)?.state) index.set(key, place);
  }
  return index;
}
