import { getDb } from "./db";
import type { CertificateFormat, CertificateSource, CertificateType } from "./certificates";

/**
 * Register of every certificate issued.
 *
 * A certificate is a document the collection hands to someone else, so the id
 * printed on it has to be traceable back to what was issued, for which work and
 * to whom. Uniqueness is enforced by the table rather than by the caller.
 */

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  ref TEXT NOT NULL,
  registro TEXT,
  type TEXT NOT NULL,
  party TEXT,
  issued_on TEXT,
  formats TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_certificates_ref ON certificates(ref);
`;

/**
 * Columns added once certificates started keeping their files. Added one by one
 * so an existing database picks them up without losing the ids already issued.
 */
const ADDED_COLUMNS: Record<string, string> = {
  source: "TEXT NOT NULL DEFAULT 'generado'",
  file_name: "TEXT",
  file_ext: "TEXT",
  file_size: "INTEGER",
  sha256: "TEXT",
  original_name: "TEXT",
  artist: "TEXT",
  title: "TEXT",
  edition: "TEXT",
  body_text: "TEXT",
  notes: "TEXT",
  updated_at: "TEXT",
};

let ready = false;

function db() {
  const handle = getDb();
  if (!ready) {
    handle.exec(CREATE_SQL);
    const existing = new Set(
      (handle.prepare("PRAGMA table_info(certificates)").all() as { name: string }[]).map((c) => c.name)
    );
    for (const [column, definition] of Object.entries(ADDED_COLUMNS)) {
      if (!existing.has(column)) handle.exec(`ALTER TABLE certificates ADD COLUMN ${column} ${definition}`);
    }
    handle.exec("CREATE INDEX IF NOT EXISTS idx_certificates_registro ON certificates(registro)");
    ready = true;
  }
  return handle;
}

export type CertificateRecord = {
  id: number;
  code: string;
  ref: string;
  registro: string | null;
  type: string;
  party: string | null;
  issued_on: string | null;
  formats: string;
  created_at: string;
  source: CertificateSource;
  /** Stored name inside data/certificates; null when the file was never kept. */
  file_name: string | null;
  file_ext: string | null;
  file_size: number | null;
  sha256: string | null;
  /** The filename it had in the folder it was brought in from. */
  original_name: string | null;
  artist: string | null;
  title: string | null;
  edition: string | null;
  /** The document's text, for search and preview. */
  body_text: string | null;
  notes: string | null;
  updated_at: string | null;
};

export function getCertificateByCode(code: string): CertificateRecord | null {
  return (
    (db().prepare("SELECT * FROM certificates WHERE code = ?").get(code) as CertificateRecord) ??
    null
  );
}

/**
 * Mints the next id for the current year — CRV-2026-0001 — inside a
 * transaction, so two downloads at once cannot land on the same number.
 */
export function issueCertificate(input: {
  ref: string;
  registro: string;
  type: CertificateType;
  party: string;
  issuedOn: string;
  format: CertificateFormat;
}): CertificateRecord {
  const handle = db();
  const year = new Date().getFullYear();
  const prefix = `CRV-${year}-`;

  const create = handle.transaction(() => {
    const last = handle
      .prepare(
        "SELECT code FROM certificates WHERE code LIKE @like ORDER BY code DESC LIMIT 1"
      )
      .get({ like: `${prefix}%` }) as { code: string } | undefined;

    const next = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
    const code = `${prefix}${String(next).padStart(4, "0")}`;

    handle
      .prepare(
        `INSERT INTO certificates (code, ref, registro, type, party, issued_on, formats)
         VALUES (@code, @ref, @registro, @type, @party, @issuedOn, @format)`
      )
      .run({ ...input, code });

    return code;
  });

  return getCertificateByCode(create())!;
}

/** Records that the same certificate was also downloaded in another format. */
export function noteFormat(code: string, format: CertificateFormat): void {
  const record = getCertificateByCode(code);
  if (!record) return;
  const formats = new Set(record.formats.split(",").filter(Boolean));
  if (formats.has(format)) return;
  formats.add(format);
  db()
    .prepare("UPDATE certificates SET formats = ? WHERE code = ?")
    .run([...formats].join(","), code);
}

export function getCertificate(id: number): CertificateRecord | null {
  return (db().prepare("SELECT * FROM certificates WHERE id = ?").get(id) as CertificateRecord) ?? null;
}

export function listCertificates(): CertificateRecord[] {
  return db()
    .prepare("SELECT * FROM certificates ORDER BY COALESCE(issued_on, substr(created_at, 1, 10)) DESC, id DESC")
    .all() as CertificateRecord[];
}

/** Registros printed on certificates, including ones whose ref differs (0754b on 0754). */
export function certificatesForArtwork(ref: string, registro: string): CertificateRecord[] {
  return db()
    .prepare("SELECT * FROM certificates WHERE ref = ? OR (ref = '' AND registro = ?) ORDER BY id DESC")
    .all(ref, registro) as CertificateRecord[];
}

export function findCertificateByHash(sha256: string): CertificateRecord | null {
  return (
    (db().prepare("SELECT * FROM certificates WHERE sha256 = ?").get(sha256) as CertificateRecord) ?? null
  );
}

/**
 * Files an existing certificate — one issued outside the app, in Word. It gets
 * an ARCH- code instead of a CRV-year code, since the paper never carried one.
 */
export function addArchivedCertificate(input: {
  ref: string;
  registro: string | null;
  type: CertificateType;
  party: string | null;
  issuedOn: string | null;
  artist?: string | null;
  title?: string | null;
  edition?: string | null;
  bodyText?: string | null;
  originalName?: string | null;
  notes?: string | null;
  fileExt: string;
}): CertificateRecord {
  const handle = db();
  const create = handle.transaction(() => {
    const last = handle
      .prepare("SELECT code FROM certificates WHERE code LIKE 'ARCH-%' ORDER BY code DESC LIMIT 1")
      .get() as { code: string } | undefined;
    const next = last ? Number(last.code.slice(5)) + 1 : 1;
    const code = `ARCH-${String(next).padStart(4, "0")}`;
    handle
      .prepare(
        `INSERT INTO certificates
           (code, ref, registro, type, party, issued_on, formats, source, file_ext,
            original_name, artist, title, edition, body_text, notes, updated_at)
         VALUES
           (@code, @ref, @registro, @type, @party, @issuedOn, @fileExt, 'archivo', @fileExt,
            @originalName, @artist, @title, @edition, @bodyText, @notes, datetime('now'))`
      )
      .run({
        artist: null,
        title: null,
        edition: null,
        bodyText: null,
        originalName: null,
        notes: null,
        ...input,
        code,
      });
    return code;
  });
  return getCertificateByCode(create())!;
}

export function setCertificateFile(
  id: number,
  file: { fileName: string; ext: string; size: number; sha256: string }
): void {
  db()
    .prepare(
      `UPDATE certificates
         SET file_name = @fileName, file_ext = @ext, file_size = @size, sha256 = @sha256,
             updated_at = datetime('now')
       WHERE id = @id`
    )
    .run({ ...file, id });
}

export type CertificatePatch = Partial<{
  ref: string;
  registro: string | null;
  type: CertificateType;
  party: string | null;
  issued_on: string | null;
  notes: string | null;
}>;

const EDITABLE = ["ref", "registro", "type", "party", "issued_on", "notes"] as const;

export function updateCertificate(id: number, patch: CertificatePatch): CertificateRecord | null {
  const keys = EDITABLE.filter((key) => key in patch);
  if (keys.length) {
    db()
      .prepare(
        `UPDATE certificates SET ${keys.map((k) => `${k} = @${k}`).join(", ")}, updated_at = datetime('now') WHERE id = @id`
      )
      .run({ ...Object.fromEntries(keys.map((k) => [k, patch[k] ?? null])), id });
  }
  return getCertificate(id);
}

export function deleteCertificate(id: number): void {
  db().prepare("DELETE FROM certificates WHERE id = ?").run(id);
}

/**
 * The inventory record a printed CRV number belongs to, or "" when none does.
 * Certificates print the number as the owner wrote it at the time, which does
 * not always match the registro: "0754b" is one cast of 0754, and "0909" is the
 * triptych filed as 0909.a-c.
 */
export function resolveCertificateRef(registro: string | null): string {
  const number = (registro ?? "").trim();
  if (!number) return "";
  const handle = db();
  const exact = (registro: string) =>
    handle.prepare("SELECT ref FROM artworks WHERE registro = ? ORDER BY id LIMIT 1").get(registro) as
      | { ref: string }
      | undefined;

  const direct = exact(number);
  if (direct) return direct.ref;

  const withoutLetter = number.match(/^(\d+)[a-z]$/i);
  if (withoutLetter) {
    const cast = exact(withoutLetter[1]);
    if (cast) return cast.ref;
  }

  const grouped = handle
    .prepare("SELECT ref FROM artworks WHERE registro LIKE ? LIMIT 2")
    .all(`${number}.%`) as { ref: string }[];
  return grouped.length === 1 ? grouped[0].ref : "";
}
