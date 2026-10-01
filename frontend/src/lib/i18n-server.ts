import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LANG_COOKIE, isLocale, tr, type Locale } from "./i18n";

/**
 * The visitor's language, remembered in a cookie so every server component
 * renders in the same one. Split from `i18n.ts` because `next/headers` is
 * server-only and the dictionary is shared with client components.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LANG_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Server-side `tr`, bound to the visitor's language. */
export async function getTr() {
  const locale = await getLocale();
  return (es: string, vars?: Record<string, string | number>) => tr(locale, es, vars);
}
