export type SearchParams = Record<string, string | string[] | undefined>;

export function toURLSearchParams(params: SearchParams): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) search.set(key, value);
    else if (Array.isArray(value) && value[0]) search.set(key, value[0]);
  }
  return search;
}

/** Builds a link that keeps the current filters and changes only what is passed. */
export function hrefWith(
  base: string,
  params: SearchParams,
  overrides: Record<string, string | number | undefined | null>
): string {
  const search = toURLSearchParams(params);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null || value === "") search.delete(key);
    else search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}
