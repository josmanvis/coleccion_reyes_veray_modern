"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, dateLocaleOf, tr, type Locale } from "@/lib/i18n";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Gives client components the language the server rendered the page in. */
export default function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** What to hand `toLocaleDateString` and friends. */
export function useDateLocale(): string {
  return dateLocaleOf(useContext(LocaleContext));
}

/** Client-side `tr`: `const tr = useTr(); tr("Guardar")`. */
export function useTr() {
  const locale = useContext(LocaleContext);
  return (es: string, vars?: Record<string, string | number>) => tr(locale, es, vars);
}
