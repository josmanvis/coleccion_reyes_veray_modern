/**
 * Certificate wording and helpers.
 *
 * Modelled on the certificates the collection already issues in Word, so a
 * generated one reads the same as the hundreds on file. No database import, so
 * the admin form can share these definitions.
 */

export const CERTIFICATE_TYPES = ["obsequio", "adquisicion", "donacion"] as const;

export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

type TypeCopy = {
  /** "Certificado de obsequio" */
  heading: string;
  /** The sentence above the party, minus the party itself. */
  sentence: string;
  /** What the party field means, shown as the form's label. */
  partyLabel: string;
};

export const CERTIFICATE_COPY: Record<CertificateType, TypeCopy> = {
  obsequio: {
    heading: "Certificado de obsequio",
    sentence: "Este documento certifica el obsequio de la pieza arriba mencionada por",
    partyLabel: "Obsequiada por",
  },
  adquisicion: {
    heading: "Certificado de adquisición",
    sentence: "Este documento certifica la adquisición de la pieza arriba mencionada a",
    partyLabel: "Adquirida a",
  },
  donacion: {
    heading: "Certificado de donación",
    sentence: "Este documento certifica la donación de la pieza arriba mencionada a",
    partyLabel: "Donada a",
  },
};

export const SIGNATORY = "Otto Octavio Reyes Casanova";
export const COLLECTION_NAME = "Colección Reyes Veray";

/**
 * The certificates print the medium in both languages. The vocabulary is small
 * and closed, so a glossary covers almost everything; anything unknown falls
 * through unchanged and can be corrected in the form before downloading.
 */
const TECHNIQUE_EN: Record<string, string> = {
  "acrílico": "acrylic",
  "acuarela": "watercolor",
  "aguafuerte": "etching",
  "arte digital": "digital art",
  "carboncillo": "charcoal",
  "cerámica": "ceramic",
  "collage": "collage",
  "fotografía": "photograph",
  "gouache": "gouache",
  "grabado": "engraving",
  "grafito": "graphite",
  "impresión digital": "digital print",
  "lápiz": "pencil",
  "linografía": "linocut",
  "linóleo": "linocut",
  "litografía": "lithograph",
  "litografia": "lithograph",
  "medio mixto": "mixed media",
  "mixto": "mixed media",
  "óleo": "oil",
  "pastel": "pastel",
  "pintura": "painting",
  "punta seca": "drypoint",
  "serigrafía": "silkscreen",
  "serigrafia": "silkscreen",
  "tinta": "ink",
  "xilografía": "woodcut",
  "xilografia": "woodcut",
};

const SUPPORT_EN: Record<string, string> = {
  "canvas": "canvas",
  "cartón": "cardboard",
  "carton": "cardboard",
  "cartulina": "cardstock",
  "cerámica": "ceramic",
  "lienzo": "canvas",
  "lino": "linen",
  "madera": "wood",
  "masonite": "masonite",
  "papel": "paper",
  "tela": "canvas",
};

function translate(value: string, glossary: Record<string, string>): string {
  const key = value.trim().toLowerCase();
  if (glossary[key]) return glossary[key];
  // "papel Mohawk Superfine" -> "Mohawk Superfine paper"
  for (const [spanish, english] of Object.entries(glossary)) {
    if (key.startsWith(`${spanish} `)) {
      return `${value.trim().slice(spanish.length).trim()} ${english}`;
    }
  }
  return value.trim();
}

/** "óleo" + "canvas" -> "óleo sobre canvas // oil on canvas" */
export function mediumLine(technique: string | null, support: string | null): string {
  const tech = (technique ?? "").trim();
  const sup = (support ?? "").trim();
  if (!tech && !sup) return "";
  if (!sup) return `${tech} // ${translate(tech, TECHNIQUE_EN)}`;
  if (!tech) return `${sup} // ${translate(sup, SUPPORT_EN)}`;
  return `${tech} sobre ${sup} // ${translate(tech, TECHNIQUE_EN)} on ${translate(sup, SUPPORT_EN)}`;
}

/**
 * The certificates on file write inch marks as a typographic double prime
 * (16” x 19”), while the records store a straight quote.
 */
export function typographicInches(value: string): string {
  return value.replace(/"/g, "\u201d");
}

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2024-05-22" -> "22 de mayo de 2024", the form the certificates use. */
export function spanishDate(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  const [, year, month, day] = match;
  return `${Number(day)} de ${MONTHS_ES[Number(month) - 1]} de ${year}`;
}

export function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export type CertificateInput = {
  type: CertificateType;
  artist: string;
  registro: string;
  title: string;
  medium: string;
  dimensions: string;
  year: string;
  /** Printed as "Ed. 27/90" or "Ed. P/A", the way the existing certificates read. */
  edition?: string;
  /** Who gifted, who it was acquired from, or who it was donated to. */
  party: string;
  /** ISO date; rendered in Spanish. */
  date: string;
  exhibitions?: string;
  publications?: string;
  imageUrl?: string | null;
  /** Registry id printed on the document, e.g. CRV-2026-0001. */
  code?: string;
  /** From settings, so an installation can sign with a different name. */
  signatory?: string;
  collectionName?: string;
};

export type CertificateFormat = "pdf";

export function certificateFilename(input: CertificateInput): string {
  return certificateDisplayName(input.type, input.registro, "pdf");
}

export function isCertificateType(value: unknown): value is CertificateType {
  return typeof value === "string" && (CERTIFICATE_TYPES as readonly string[]).includes(value);
}

/**
 * Every certificate, generated or brought in from Word, is named
 * "Certificado de <tipo> CRV <número>". The name is derived rather than stored,
 * so correcting the type or number renames the file everywhere at once.
 */
export function certificateDisplayName(
  type: string,
  registro: string | null,
  extension?: string | null
): string {
  const heading = isCertificateType(type) ? CERTIFICATE_COPY[type].heading : `Certificado de ${type}`;
  const number = (registro ?? "").trim();
  const name = `${heading} ${number ? `CRV ${number}` : "(sin CRV)"}`.replace(/\s+/g, " ");
  return extension ? `${name}.${extension}` : name;
}

/** File formats a certificate can be kept in. */
export const CERTIFICATE_FILE_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  // One certificate on file was saved as a Word template.
  dotx: "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
};

/** Where a certificate came from: minted by the app, or an existing Word file. */
export type CertificateSource = "generado" | "archivo";
