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

import { ADMIN_EN } from "./i18n-admin";

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

  // --- chrome ---
  "nav.menu": { en: "Menu", es: "Menú" },
  "nav.close": { en: "Close", es: "Cerrar" },
  "nav.pagination": { en: "Pagination", es: "Paginación" },
  "footer.poweredBy": { en: "Powered by", es: "Desarrollado por" },

  // --- home ---
  "home.headline": {
    en: "An exploration of contemporary visual narratives.",
    es: "Una exploración de las narrativas visuales contemporáneas.",
  },
  "home.est": { en: "Est. 2005 — San Juan, Puerto Rico", es: "Est. 2005 — San Juan, Puerto Rico" },
  "home.viewDetails": { en: "View Details", es: "Ver detalles" },

  // --- inventory (gallery) ---
  "gallery.title": { en: "Inventory", es: "Inventario" },
  "gallery.intro": {
    en: "Accessing secure viewing room. Complete collection provenance and high-resolution asset management. {n} indexed records synchronized via Axxes Club DAM.",
    es: "Acceso a la sala de visualización segura. Procedencia completa de la colección y gestión de activos en alta resolución. {n} registros indexados y sincronizados mediante Axxes Club DAM.",
  },
  "gallery.search": {
    en: "Search by artist, title, or medium...",
    es: "Buscar por artista, título o medio...",
  },
  "gallery.noMatch": {
    en: "No records found matching \"{q}\"",
    es: "No se encontraron registros para \"{q}\"",
  },
  "gallery.assetPending": { en: "Asset Pending", es: "Imagen pendiente" },
  "gallery.examine": { en: "Examine", es: "Examinar" },

  // --- about ---
  "about.role": { en: "Architect • Collector • Curator", es: "Arquitecto • Coleccionista • Curador" },
  "about.p1": {
    en: "The Colección Reyes-Veray is the private archive of architect Otto Reyes Casanova. For decades, the collection has grown to become one of the most significant surveys of contemporary visual arts in Puerto Rico.",
    es: "La Colección Reyes-Veray es el archivo privado del arquitecto Otto Reyes Casanova. Durante décadas, la colección ha crecido hasta convertirse en uno de los panoramas más importantes de las artes visuales contemporáneas en Puerto Rico.",
  },
  "about.p2": {
    en: "Guided by an architectural sensibility, the collection emphasizes structure, space, and the raw narrative of the human condition. It serves not merely as an aggregation of objects, but as a deliberate cultural thesis.",
    es: "Guiada por una sensibilidad arquitectónica, la colección destaca la estructura, el espacio y la narrativa cruda de la condición humana. No es una simple acumulación de objetos, sino una tesis cultural deliberada.",
  },
  "about.index": { en: "Selected Projects & Index", es: "Proyectos selectos e índice" },
  "about.catalogue": { en: "Complete Catalogue", es: "Catálogo completo" },
  "about.macExhibition": { en: "MAC Exhibition", es: "Exposición en el MAC" },
  "about.inquiries": { en: "Inquiries", es: "Consultas" },
  "about.metaDescription": {
    en: "The Colección Reyes-Veray is the private archive of architect Otto Reyes Casanova.",
    es: "La Colección Reyes-Veray es el archivo privado del arquitecto Otto Reyes Casanova.",
  },

  // --- exhibition ---
  "exhibition.title": {
    en: "The Colección Reyes-Veray at the Museum of Contemporary Art",
    es: "La Colección Reyes-Veray en el Museo de Arte Contemporáneo",
  },
  "exhibition.sub": {
    en: "Past Exhibitions • San Juan, Puerto Rico",
    es: "Exposiciones pasadas • San Juan, Puerto Rico",
  },
  "exhibition.p1": {
    en: "The Reyes-Veray Collection has been featured in major institutions, highlighting the depth of contemporary visual narratives in Puerto Rico. The exhibition at the Museo de Arte Contemporáneo de Puerto Rico (MAC) stands as a testament to the cultural importance of the archive.",
    es: "La Colección Reyes-Veray ha sido presentada en importantes instituciones, destacando la profundidad de las narrativas visuales contemporáneas en Puerto Rico. La exposición en el Museo de Arte Contemporáneo de Puerto Rico (MAC) es testimonio de la importancia cultural del archivo.",
  },
  "exhibition.p2": {
    en: "Curated meticulously to showcase the evolution of local and international contemporary art, the collection provides a critical lens into the intersection of identity, space, and modernism.",
    es: "Curada meticulosamente para mostrar la evolución del arte contemporáneo local e internacional, la colección ofrece una mirada crítica a la intersección entre identidad, espacio y modernismo.",
  },
  "exhibition.explore": { en: "Explore the Full Catalogue", es: "Explorar el catálogo completo" },
  "exhibition.museum": {
    en: "Museo de Arte Contemporáneo de Puerto Rico",
    es: "Museo de Arte Contemporáneo de Puerto Rico",
  },
  "exhibition.metaDescription": {
    en: "The Colección Reyes-Veray at the Museo de Arte Contemporáneo de Puerto Rico.",
    es: "La Colección Reyes-Veray en el Museo de Arte Contemporáneo de Puerto Rico.",
  },

  // --- contact ---
  "contact.title": { en: "Contact", es: "Contacto" },
  "contact.intro": {
    en: "For inquiries regarding the collection, exhibitions, or private viewing rooms, please reach out to the curator.",
    es: "Para consultas sobre la colección, exposiciones o salas de visualización privadas, comuníquese con el curador.",
  },
  "contact.thanks": { en: "Thank you.", es: "Gracias." },
  "contact.sent": {
    en: "Your inquiry has been logged with the gallery. We will be in touch shortly.",
    es: "Su consulta ha sido registrada en la galería. Nos pondremos en contacto pronto.",
  },
  "form.name": { en: "Full Name", es: "Nombre completo" },
  "form.email": { en: "Email Address", es: "Correo electrónico" },
  "form.message": { en: "Message", es: "Mensaje" },
  "form.messageOptional": { en: "Message (Optional)", es: "Mensaje (opcional)" },
  "form.namePlaceholder": { en: "Jane Doe", es: "Nombre Apellido" },
  "contact.messagePlaceholder": { en: "How can we help?", es: "¿En qué podemos ayudarle?" },
  "form.sending": { en: "Sending…", es: "Enviando…" },
  "contact.send": { en: "Send Inquiry", es: "Enviar consulta" },
  "contact.error": {
    en: "Something went wrong — please try again or email {email} directly.",
    es: "Algo salió mal — inténtelo de nuevo o escriba directamente a {email}.",
  },
  "contact.metaDescription": {
    en: "Contact the curator of the Colección Reyes-Veray.",
    es: "Contacte al curador de la Colección Reyes-Veray.",
  },

  // --- acquire ---
  "acquire.short": { en: "Acquire", es: "Adquirir" },
  "acquire.long": { en: "Acquire Artwork", es: "Adquirir obra" },
  "acquire.title": { en: "Acquisition Request", es: "Solicitud de adquisición" },
  "acquire.private": { en: "Private Collection", es: "Colección privada" },
  "acquire.messagePlaceholder": {
    en: "I would like to know more about this piece...",
    es: "Me gustaría saber más sobre esta obra...",
  },
  "acquire.notice": {
    en: "By submitting this request, a formal inquiry will be drafted to the gallery director regarding the acquisition of this piece. You will be contacted shortly with pricing and private viewing options.",
    es: "Al enviar esta solicitud, se redactará una consulta formal a la dirección de la galería sobre la adquisición de esta obra. Se le contactará pronto con información de precios y visitas privadas.",
  },
  "acquire.submit": { en: "Request Dossier & Pricing", es: "Solicitar dossier y precio" },
  "acquire.received": { en: "Inquiry Received ✓", es: "Consulta recibida ✓" },
  "acquire.error": {
    en: "Something went wrong — please try again or email us directly.",
    es: "Algo salió mal — inténtelo de nuevo o escríbanos directamente.",
  },
  "acquire.mailSubject": { en: "Acquisition Inquiry: {title}", es: "Consulta de adquisición: {title}" },
  "acquire.mailBody": {
    en: "Dear Curator,\n\nI am interested in acquiring the following piece:\n\n{title}\n\nPlease provide information regarding pricing, availability, and shipping logistics.\n\nBest regards,\n{name}\n{email}",
    es: "Estimado curador:\n\nMe interesa adquirir la siguiente obra:\n\n{title}\n\nAgradeceré información sobre precio, disponibilidad y envío.\n\nSaludos cordiales,\n{name}\n{email}",
  },
  "share.label": { en: "Share", es: "Compartir" },
  "share.copied": { en: "Link copied to clipboard!", es: "¡Enlace copiado al portapapeles!" },
  "works.sheets": { en: "{n} sheets", es: "{n} hojas" },
  "chat.open": { en: "Open assistant", es: "Abrir asistente" },
  "chat.empty": { en: "Ask Ocho anything you need.", es: "Pregunta lo que necesites a Ocho." },
  "chat.thinking": { en: "Thinking...", es: "Pensando..." },
  "chat.placeholder": { en: "Type your message...", es: "Escribe tu mensaje..." },
  "chat.error": { en: "Error connecting to Ocho.", es: "Error al conectar con Ocho." },
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

/**
 * Admin copy is keyed by its Spanish text — the language the interface was
 * written in — and `ADMIN_EN` holds the English. A string with no entry falls
 * back to the Spanish rather than rendering blank; `scripts/check-i18n.mjs`
 * lists any that are missing.
 */
export function tr(
  locale: Locale,
  es: string,
  vars?: Record<string, string | number>
): string {
  let text = locale === "en" ? (ADMIN_EN[es] ?? es) : es;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** The BCP 47 tag the browser's date formatting should use. */
export function dateLocaleOf(locale: Locale): string {
  return locale === "en" ? "en-US" : "es";
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
