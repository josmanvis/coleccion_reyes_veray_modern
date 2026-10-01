import manifest from "@/data/image-manifest.json";
const paths = manifest.paths as Record<string, string>;
const aliases = manifest.aliases as Record<string, string>;
export function resolveImage(input: string): string {
  if (!input) return "/asset-pending.svg";
  if (aliases[input]) return aliases[input];
  if (input.startsWith("https://storage.googleapis.com/")) return input;
  let path = input;
  try {
    if (/^https?:\/\//i.test(input)) {
      const url = new URL(input);
      if (/^i[0-3]\.wp\.com$/.test(url.hostname)) path = url.pathname.replace(/^\/coleccionreyesveray\.com(?:\.\.)?(?=\/wp-content\/)/, "");
      else if (["coleccionreyesveray.com", "www.coleccionreyesveray.com"].includes(url.hostname)) path = url.pathname;
      else return "/asset-pending.svg";
    }
    path = decodeURIComponent(path.split("?")[0]);
  } catch { return "/asset-pending.svg"; }
  return paths[path] ?? "/asset-pending.svg";
}

export function resolvePageImages<T>(value: T): T {
  if (typeof value === "string") {
    if (value.startsWith("/wp-content/") || /^https?:\/\/(?:i[0-3]\.wp\.com|utfs\.io|[^/]*coleccionreyesveray\.com)\//.test(value)) return resolveImage(value) as T;
    return value.replace(/(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi, (_, before, url, after) => `${before}${resolveImage(url)}${after}`) as T;
  }
  if (Array.isArray(value)) return value.map(resolvePageImages) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolvePageImages(item)])) as T;
  return value;
}
