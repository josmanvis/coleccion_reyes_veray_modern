/**
 * Site copy in both languages.
 *
 * Interface strings only. Catalogue data — titles, techniques, biographies —
 * stays exactly as recorded; the biographies are sometimes bilingual and
 * sometimes not, and there is no reliable way to split one, so translating
 * them here would mean inventing text the collection never wrote.
 *
 * Kept free of imports so client components can use it (see
 * project-client-server-module-split).
 */

export const LOCALES = ["en", "es"] as const;

export type Locale = (typeof LOCALES)[number];

/** The site has always rendered in English; switching is opt-in. */
export const DEFAULT_LOCALE: Locale = "en";

export const LANG_COOKIE = "crv_lang";
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

const COPY = {
  // --- navigation ---
  "nav.inventory": { en: "Inventory", es: "Inventario" },
  "nav.artists": { en: "Artists", es: "Artistas" },
  "nav.portfolios": { en: "Portfolios", es: "Portafolios" },
  "nav.forSale": { en: "For Sale", es: "En venta" },
  "nav.exhibition": { en: "Exhibition", es: "Exposición" },
  "nav.collector": { en: "Collector", es: "Coleccionista" },
  "nav.contact": { en: "Contact", es: "Contacto" },

  // --- artists ---
  "artists.title": { en: "Artists", es: "Artistas" },
  "artists.count": { en: "{n} artists · {m} works", es: "{n} artistas · {m} obras" },
  "artists.back": { en: "← All artists", es: "← Todos los artistas" },
  "artist.works": {
    en: "{n} works in the collection",
    es: "{n} obras en la colección",
  },
  "artist.work": { en: "{n} work in the collection", es: "{n} obra en la colección" },

  // --- portfolios ---
  "portfolios.title": { en: "Portfolios", es: "Portafolios" },
  "portfolios.count": { en: "{n} portfolios · {m} sheets", es: "{n} portafolios · {m} hojas" },
  "portfolios.back": { en: "← All portfolios", es: "← Todos los portafolios" },
  "portfolio.label": { en: "Portfolio", es: "Portafolio" },
  "portfolio.sheets": { en: "{n} sheets · CRV #{base}", es: "{n} hojas · CRV #{base}" },

  // --- works ---
  "works.none": { en: "No works on file", es: "Sin obras registradas" },
  "works.untitled": { en: "Untitled", es: "Sin título" },
  "works.noImage": { en: "No image", es: "Sin imagen" },

  // --- artwork page ---
  "art.back": { en: "← Return to gallery", es: "← Volver a la galería" },
  "art.details": { en: "Details", es: "Ficha técnica" },
  "art.year": { en: "Year", es: "Año" },
  "art.medium": { en: "Medium", es: "Medio" },
  "art.technique": { en: "Technique", es: "Técnica" },
  "art.dimensions": { en: "Dimensions", es: "Dimensiones" },
  "art.registro": { en: "Registry no.", es: "N.º de registro" },
  "art.viewingRoom": { en: "Interactive viewing room", es: "Sala de visualización" },
  "art.zoomHint": {
    en: "Scroll to zoom · drag to pan · Esc to close",
    es: "Rueda para acercar · arrastra para mover · Esc para cerrar",
  },
  "art.close": { en: "Close", es: "Cerrar" },
  "art.allByArtist": { en: "All works by this artist →", es: "Todas las obras de este artista →" },
  "art.download": { en: "Download hi-res", es: "Descargar alta resolución" },
  "art.enquire": { en: "Enquire about this work", es: "Consultar por esta obra" },

  // --- for sale ---
  "sale.title": { en: "For Sale", es: "En venta" },
  "sale.available": { en: "{n} works available", es: "{n} obras disponibles" },
  "sale.availableOne": { en: "{n} work available", es: "{n} obra disponible" },
  "sale.onRequestCount": { en: "{n} on request", es: "{n} a consultar" },
  "sale.intro": {
    en: "Enquiries are welcome on any work listed here. Prices shown are asking prices; write to us for condition reports and shipping.",
    es: "Atendemos consultas sobre cualquier obra de esta lista. Los precios indicados son precios de salida; escríbanos para informes de condición y envío.",
  },
  "sale.asking": { en: "Asking", es: "Precio" },
  "sale.onRequest": { en: "Price on request", es: "Precio a consultar" },
  "sale.moreByArtist": { en: "More by this artist →", es: "Más de este artista →" },
  "sale.enquire": { en: "Enquire about a work →", es: "Consultar por una obra →" },
  "sale.empty": {
    en: "No works are currently offered",
    es: "No hay obras en venta por el momento",
  },
} as const;

export type CopyKey = keyof typeof COPY;

/**
 * Looks up a string, filling {placeholders} from `vars`.
 * Unknown keys return the key itself, which shows up loudly in the UI rather
 * than silently rendering an empty element.
 */
export function t(
  locale: Locale,
  key: CopyKey,
  vars?: Record<string, string | number>
): string {
  const entry = COPY[key];
  if (!entry) return key;
  let text: string = entry[locale] ?? entry[DEFAULT_LOCALE];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
