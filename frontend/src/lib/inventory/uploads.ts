/**
 * Image uploads for the CMS.
 *
 * Files land in `public/uploads`, next to the SQLite database this admin already
 * keeps on disk, and are served by Next as ordinary static files. No external
 * service and no API token, which also keeps uploads working offline.
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { recordMedia, type MediaRow } from "./pages";

export const UPLOAD_DIR =
  process.env.INVENTORY_UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

/** Served from /uploads/<name>; the public folder is the web root. */
const PUBLIC_PREFIX = "/uploads";

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** Only formats a browser renders inline, so a page can never link to a binary. */
const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
};

export function isAllowedType(mime: string): boolean {
  return mime in ALLOWED;
}

function safeStem(filename: string): string {
  return (
    path
      .basename(filename, path.extname(filename))
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "imagen"
  );
}

export type StoredUpload = MediaRow;

/**
 * Writes the file under a name derived from the original plus a short random
 * suffix, so re-uploading "foto.jpg" never overwrites an image a page still
 * points at.
 */
export async function storeUpload(file: File, alt?: string | null): Promise<StoredUpload> {
  const mime = file.type || "application/octet-stream";
  if (!isAllowedType(mime)) {
    throw new Error(`Formato no admitido: ${mime}`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es ${
        MAX_UPLOAD_BYTES / 1024 / 1024
      } MB`
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) throw new Error("El archivo está vacío");

  const name = `${safeStem(file.name)}-${crypto.randomBytes(4).toString("hex")}${ALLOWED[mime]}`;

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), bytes);

  return recordMedia({
    filename: name,
    url: `${PUBLIC_PREFIX}/${name}`,
    mime,
    bytes: bytes.length,
    alt: alt ?? null,
  });
}

/** Removes the file from disk; a missing file is not an error. */
export async function removeUploadFile(filename: string): Promise<void> {
  // Guard against a stored name trying to escape the uploads folder.
  const target = path.join(UPLOAD_DIR, path.basename(filename));
  await fs.rm(target, { force: true });
}
