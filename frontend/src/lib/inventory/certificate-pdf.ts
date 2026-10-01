import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  CERTIFICATE_COPY,
  COLLECTION_NAME,
  SIGNATORY,
  spanishDate,
  typographicInches,
  type CertificateInput,
} from "./certificates";

/**
 * The same certificate as the Word version, as a self-contained PDF.
 *
 * The Word file names Lucida Calligraphy, which only renders on a machine that
 * has it — it silently substitutes elsewhere. The PDF embeds its fonts, so it
 * prints identically everywhere, at the cost of using Times rather than the
 * script face for the ceremonial lines.
 */

const LETTER: [number, number] = [612, 792];
const MARGIN = 72;
const CONTENT_WIDTH = LETTER[0] - MARGIN * 2;

/**
 * pdf-lib's standard fonts are WinAnsi and throw on anything outside it.
 * Latin-1 already covers the Spanish accents, and CP1252 adds the curly quotes
 * and dashes these certificates use, so only the leftovers are dropped.
 */
const CP1252_EXTRAS = new Set<number>([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

function toWinAnsi(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0xff || CP1252_EXTRAS.has(code)) out += char;
    else if (code === 0x2015 || code === 0x2500) out += String.fromCharCode(0x2014);
  }
  return out;
}

type Cursor = { page: PDFPage; y: number; doc: PDFDocument };

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function centered(
  cursor: Cursor,
  text: string,
  font: PDFFont,
  size: number,
  gapAfter = 6
): void {
  for (const line of wrap(toWinAnsi(text), font, size, CONTENT_WIDTH)) {
    const width = font.widthOfTextAtSize(line, size);
    if (cursor.y - size < MARGIN) {
      cursor.page = cursor.doc.addPage(LETTER);
      cursor.y = LETTER[1] - MARGIN;
    }
    cursor.page.drawText(line, {
      x: (LETTER[0] - width) / 2,
      y: cursor.y - size,
      size,
      font,
      color: rgb(0, 0, 0),
    });
    cursor.y -= size * 1.35;
  }
  cursor.y -= gapAfter;
}

/**
 * The collection's mark, faint, in the space between the date and the
 * certificate number at the foot.
 *
 * Drawn after the text rather than before it, because where it goes depends on
 * where the writing stopped: it is centred in whatever room is left above the
 * number. If a long certificate leaves no such gap it is skipped — a mark
 * printed over the signature would be worse than no mark.
 *
 * The supplied logo is near-white ink (235,235,236) meant for a dark
 * background, so drawing it straight onto white paper produced nothing
 * visible. `crv-mark-ink.png` is the mark lifted from the book's endpapers at
 * 460x422 — over four times the artwork we had — with the ink repainted near
 * black, which is what makes it show on a white page at all.
 */
async function drawWatermark(doc: PDFDocument, page: PDFPage, contentBottom: number) {
  try {
    const file = path.join(process.cwd(), "src", "assets", "crv-mark-ink.png");
    if (!fs.existsSync(file)) return;
    const mark = await doc.embedPng(fs.readFileSync(file));

    const width = 59;
    const height = (mark.height / mark.width) * width;

    // The band between the certificate number's line and the last thing
    // written, with a little air at each end.
    const floor = MARGIN / 2 + 14;
    const ceiling = contentBottom - 10;
    if (ceiling - floor < height) return;

    page.drawImage(mark, {
      x: (LETTER[0] - width) / 2,
      y: floor + (ceiling - floor - height) / 2,
      width,
      height,
      opacity: 0.1,
    });
  } catch {
    // A missing or unreadable mark must never stop a certificate printing.
  }
}

async function embedImage(doc: PDFDocument, url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    return isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function buildCertificatePdf(input: CertificateInput): Promise<Buffer> {
  const copy = CERTIFICATE_COPY[input.type];
  const doc = await PDFDocument.create();
  const page = doc.addPage(LETTER);

  const script = await doc.embedFont(StandardFonts.TimesRoman);
  const scriptBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);

  const cursor: Cursor = { doc, page, y: LETTER[1] - MARGIN };

  centered(cursor, copy.heading, script, 18, 14);

  const image = input.imageUrl ? await embedImage(doc, input.imageUrl) : null;
  if (image) {
    const scale = Math.min(300 / image.width, 260 / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    cursor.page.drawImage(image, {
      x: (LETTER[0] - width) / 2,
      y: cursor.y - height,
      width,
      height,
    });
    cursor.y -= height + 18;
  }

  centered(cursor, input.artist, script, 12, 2);
  centered(cursor, `CRV ${input.registro}`, sans, 9.5, 2);
  if (input.title) centered(cursor, input.title, sans, 9.5, 2);
  if (input.medium) centered(cursor, input.medium, sans, 9.5, 2);
  if (input.dimensions) centered(cursor, typographicInches(input.dimensions), sans, 9.5, 2);
  if (input.year) centered(cursor, input.year, sans, 10, input.edition ? 2 : 20);
  if (input.edition?.trim()) {
    centered(cursor, `Ed. ${input.edition.trim().replace(/^ed\.?\s*/i, "")}`, sans, 10, 20);
  }

  centered(cursor, copy.sentence, script, 12, 4);
  centered(cursor, input.party, scriptBold, 14, 22);

  centered(cursor, "Y para que así conste:", script, 11, 26);
  centered(cursor, "_".repeat(34), script, 11, 2);
  centered(cursor, input.signatory || SIGNATORY, script, 11, 2);
  centered(cursor, input.collectionName || COLLECTION_NAME, script, 11, 2);
  centered(cursor, `Otorgado ${spanishDate(input.date)}`, script, 11, 18);

  if (input.exhibitions?.trim()) {
    centered(cursor, `Exhibiciones: ${input.exhibitions.trim()}`, sans, 9, 4);
  }
  if (input.publications?.trim()) {
    centered(cursor, `Publicaciones: ${input.publications.trim()}`, sans, 9, 4);
  }

  // Only the first page carries the mark, and only once the writing on it is
  // finished, so the free space is known.
  if (cursor.page === page) await drawWatermark(doc, page, cursor.y);

  if (input.code) {
    const label = toWinAnsi(`Certificado n.º ${input.code}`);
    const width = sans.widthOfTextAtSize(label, 8);
    cursor.page.drawText(label, {
      x: (LETTER[0] - width) / 2,
      y: MARGIN / 2,
      size: 8,
      font: sans,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  return Buffer.from(await doc.save());
}
