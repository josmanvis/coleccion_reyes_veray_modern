import type { ListParams } from "./db";

function boolParam(value: string | null): boolean | undefined {
  if (value === "1") return true;
  if (value === "0") return false;
  return undefined;
}

function numberParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Shared by the API route and the /inventory page so both read a URL the same way. */
export function parseListParams(searchParams: URLSearchParams): ListParams {
  const text = (key: string) => searchParams.get(key) || undefined;
  return {
    q: text("q"),
    statusGroup: text("statusGroup"),
    artist: text("artist"),
    medium: text("medium"),
    technique: text("technique"),
    support: text("support"),
    location: text("location"),
    acquisitionMethod: text("acquisitionMethod"),
    birthPlace: text("birthPlace"),
    category: text("category"),
    yearMin: numberParam(searchParams.get("yearMin")),
    yearMax: numberParam(searchParams.get("yearMax")),
    withImage: searchParams.get("withImage") === "1",
    withoutImage: searchParams.get("withImage") === "0",
    forSale: boolParam(searchParams.get("forSale")),
    sort: text("sort"),
    dir: searchParams.get("dir") === "desc" ? "desc" : "asc",
    page: numberParam(searchParams.get("page")),
    limit: numberParam(searchParams.get("limit")),
  };
}

/** Filter keys that appear in the URL, used to build links and reset buttons. */
export const FILTER_KEYS = [
  "q",
  "statusGroup",
  "artist",
  "medium",
  "technique",
  "support",
  "location",
  "acquisitionMethod",
  "birthPlace",
  "category",
  "yearMin",
  "yearMax",
  "withImage",
  "forSale",
] as const;
