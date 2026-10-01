/**
 * Certificate files on disk, and reading the Word certificates on file.
 *
 * Files live in `data/certificates`, beside the database, under the row's id —
 * never under the human name, so renaming or retyping a certificate is only a
 * database change. The name a person sees and downloads is always derived by
 * `certificateDisplayName`.
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { CERTIFICATE_COPY, CERTIFICATE_TYPES, type CertificateType } from "./certificates";

export const CERTIFICATE_DIR =
  process.env.INVENTORY_CERTIFICATE_DIR || path.join(process.cwd(), "data", "certificates");

/** Deleted certificates are moved here rather than erased. */
const TRASH_DIR = path.join(CERTIFICATE_DIR, ".papelera");

export const MAX_CERTIFICATE_BYTES = 25 * 1024 * 1024;

function storedName(id: number, extension: string): string {
  return `${id}.${extension}`;
}

export function certificatePath(fileName: string): string {
  // Stored names are always "<id>.<ext>"; basename keeps a bad row from
  // pointing outside the folder.
  return path.join(CERTIFICATE_DIR, path.basename(fileName));
}

export async function writeCertificateFile(
  id: number,
  extension: string,
  bytes: Uint8Array
): Promise<{ fileName: string; size: number; sha256: string }> {
  await fs.mkdir(CERTIFICATE_DIR, { recursive: true });
  const fileName = storedName(id, extension);
  await fs.writeFile(certificatePath(fileName), bytes);
  return {
    fileName,
    size: bytes.byteLength,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function readCertificateFile(fileName: string): Promise<Buffer> {
  return fs.readFile(certificatePath(fileName));
}

export async function trashCertificateFile(fileName: string): Promise<void> {
  await fs.mkdir(TRASH_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await fs
    .rename(certificatePath(fileName), path.join(TRASH_DIR, `${stamp}-${path.basename(fileName)}`))
    .catch(() => undefined);
}

/**
 * Reads one entry out of a zip — enough for a .docx, without a dependency.
 * Walks the central directory, which unlike local headers always carries the
 * real sizes.
 */
function readZipEntry(zip: Buffer, name: string): Buffer | null {
  const minEnd = Math.max(0, zip.length - 65_557);
  let end = -1;
  for (let i = zip.length - 22; i >= minEnd; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;

  const count = zip.readUInt16LE(end + 10);
  let cursor = zip.readUInt32LE(end + 16);

  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) return null;
    const method = zip.readUInt16LE(cursor + 10);
    const compressed = zip.readUInt32LE(cursor + 20);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const local = zip.readUInt32LE(cursor + 42);
    const entryName = zip.toString("utf8", cursor + 46, cursor + 46 + nameLength);

    if (entryName === name) {
      const start =
        local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + compressed);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return zlib.inflateRawSync(data);
      return null;
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

/** The non-empty paragraphs of a .docx/.dotx, in order. */
export function docxParagraphs(bytes: Buffer): string[] {
  const xml = readZipEntry(bytes, "word/document.xml")?.toString("utf8");
  if (!xml) return [];
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  return paragraphs
    .map((p) =>
      decodeXml((p.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join(""))
        .trim()
    )
    .filter(Boolean);
}

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/** "Otorgado 22 de mayo de 2024" -> "2024-05-22". Tolerates "de2025". */
export function parseSpanishDate(text: string): string | null {
  const match = text.toLowerCase().match(/(\d{1,2})\s*de\s*([a-záéíóú]+)\s*de\s*(\d{4})/);
  if (!match) return null;
  const month = MONTHS[match[2]];
  if (!month) return null;
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function typeFromHeading(text: string): CertificateType | null {
  const plain = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  for (const type of CERTIFICATE_TYPES) {
    const heading = CERTIFICATE_COPY[type].heading.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    if (plain.includes(heading)) return type;
  }
  return null;
}

export type ParsedCertificate = {
  type: CertificateType | null;
  /** As printed after "CRV", e.g. "0754b". */
  registro: string | null;
  artist: string | null;
  title: string | null;
  edition: string | null;
  party: string | null;
  issuedOn: string | null;
  paragraphs: string[];
};

/**
 * Reads the fields back out of a certificate. They all follow one layout:
 * heading, artist, "CRV 0513", title, … "Este documento certifica …", party,
 * … "Otorgado <fecha>".
 */
export function parseCertificate(paragraphs: string[]): ParsedCertificate {
  const type = paragraphs.length ? typeFromHeading(paragraphs[0]) : null;
  const crvIndex = paragraphs.findIndex((p) => /^CRV\s*\d/i.test(p));
  const sentence = paragraphs.findIndex((p) => p.startsWith("Este documento certifica"));
  const issued = paragraphs.find((p) => p.startsWith("Otorgado"));
  const edition = paragraphs.find((p) => /^Ed\.\s*/.test(p));

  return {
    type,
    registro: crvIndex >= 0 ? paragraphs[crvIndex].replace(/^CRV\s*/i, "").trim() : null,
    artist: paragraphs[1] ?? null,
    title: crvIndex >= 0 ? (paragraphs[crvIndex + 1] ?? null) : (paragraphs[2] ?? null),
    edition: edition ? edition.replace(/^Ed\.\s*/, "").trim() : null,
    party: sentence >= 0 ? (paragraphs[sentence + 1] ?? null) : null,
    issuedOn: issued ? parseSpanishDate(issued) : null,
    paragraphs,
  };
}
