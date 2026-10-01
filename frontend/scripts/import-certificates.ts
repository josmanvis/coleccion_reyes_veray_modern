/**
 * Files the Word certificates issued before the app into the certificates
 * register, so they are listed, searchable and downloadable next to the ones
 * the app generates.
 *
 *   npm run certificates:import -- "/Users/ottoreyes/Desktop/CERTIFICADOS OBRAS" --dry-run
 *   npm run certificates:import -- "/Users/ottoreyes/Desktop/CERTIFICADOS OBRAS"
 *
 * The document is trusted over its filename for the type (one file named
 * "donación" is an obsequio), and the filename over the document for the
 * number, because the files carry the sheet suffix (1254.a) the paper leaves
 * out. Copies with identical text are filed once. Re-running is safe: a file
 * already filed, byte for byte, is skipped.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { closeDb, getDb } from "../src/lib/inventory/db";
import {
  addArchivedCertificate,
  findCertificateByHash,
  resolveCertificateRef,
  setCertificateFile,
} from "../src/lib/inventory/certificate-log";
import {
  docxParagraphs,
  parseCertificate,
  writeCertificateFile,
  type ParsedCertificate,
} from "../src/lib/inventory/certificate-files";
import { certificateDisplayName, CERTIFICATE_COPY } from "../src/lib/inventory/certificates";
import { record, SYSTEM_ACTOR } from "../src/lib/inventory/audit";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const folder = args.find((a) => !a.startsWith("--"));

type Found = {
  file: string;
  name: string;
  ext: string;
  bytes: Buffer;
  mtime: number;
  parsed: ParsedCertificate;
  textKey: string;
};

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      // "~$…" are Word's lock files, not certificates.
      if (entry.name.startsWith("~$") || !/\.(docx|dotx)$/i.test(entry.name)) return [];
      return [full];
    })
  );
  return nested.flat();
}

/** "Certificado de adquisición CRV 0513 2.docx" -> "0513"; "… 1254.a.docx" -> "1254.a". */
function registroFromName(name: string): string | null {
  const stem = name.replace(/\.(docx|dotx)$/i, "").trim();
  const match = stem.match(/CRV\s+(\S+)/i);
  return match ? match[1] : null;
}

function typeFromName(name: string): string | null {
  const plain = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const match = plain.match(/certificado de (\w+)/);
  return match ? match[1] : null;
}

const norm = (value: unknown) =>
  String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");

/**
 * A ficha can hold several impressions — "7, 8, 9/50" or "3/30; 8/30" — so the
 * printed edition only disagrees when its number is not among them.
 */
function sameEdition(onFile: string, printed: string): boolean {
  if (norm(onFile) === norm(printed)) return true;
  const [number, total] = norm(printed).split("/");
  if (!number || !total) return false;
  const file = norm(onFile);
  const numbers: string[] = file.match(/\d+(?=[,;/]|$)/g) ?? [];
  return file.includes(`/${total}`) && numbers.includes(number);
}

/**
 * Things a person should look at, written onto the certificate: the printed
 * edition pointing at a sibling sheet, a type that disagrees with the filename,
 * a number the inventory does not have.
 */
function reviewNotes(found: Found, registro: string | null, ref: string): string[] {
  const notes: string[] = [];
  const db = getDb();
  const fileType = typeFromName(found.name);
  const docType = found.parsed.type;
  if (fileType && docType && fileType !== docType) {
    notes.push(
      `El archivo se llamaba «${found.name}», pero el documento es un ${CERTIFICATE_COPY[docType].heading.toLowerCase()}.`
    );
  }
  if (!registro) {
    const which = [found.parsed.artist, found.parsed.title, found.parsed.edition && `Ed. ${found.parsed.edition}`]
      .filter(Boolean)
      .join(", ");
    notes.push(`El documento no tiene número CRV (${which}); asígnalo para enlazarlo a su ficha.`);
    return notes;
  }
  if (!ref) {
    notes.push(`CRV ${registro} no aparece en el inventario.`);
    return notes;
  }

  const printed = found.parsed.edition;
  if (!printed) return notes;
  const artwork = db.prepare("SELECT registro, edition FROM artworks WHERE ref = ?").get(ref) as
    | { registro: string; edition: string | null }
    | undefined;
  if (!artwork?.edition || sameEdition(artwork.edition, printed)) return notes;

  const base = artwork.registro.split(".")[0];
  const siblings = db
    .prepare("SELECT registro, edition FROM artworks WHERE (registro = ? OR registro LIKE ?) AND registro != ?")
    .all(base, `${base}.%`, artwork.registro) as { registro: string; edition: string | null }[];
  const match = siblings.find((s) => norm(s.edition) === norm(printed));
  notes.push(
    match
      ? `El certificado imprime Ed. ${printed}, que en el inventario es ${match.registro}, no ${artwork.registro} (Ed. ${artwork.edition}).`
      : `El certificado imprime Ed. ${printed}; la ficha ${artwork.registro} dice Ed. ${artwork.edition}.`
  );
  return notes;
}

async function main() {
  if (!folder) throw new Error("Indica la carpeta de certificados");
  const files = await walk(path.resolve(folder));

  const found: Found[] = [];
  for (const file of files) {
    const bytes = await fs.readFile(file);
    const stat = await fs.stat(file);
    const paragraphs = docxParagraphs(bytes);
    found.push({
      file,
      name: path.basename(file),
      ext: path.extname(file).slice(1).toLowerCase(),
      bytes,
      mtime: stat.mtimeMs,
      parsed: parseCertificate(paragraphs),
      textKey: crypto.createHash("sha256").update(paragraphs.join("\n")).digest("hex"),
    });
  }

  // Identical text is one certificate saved twice (the "2" folder, "copy");
  // keep the most recently saved file, preferring one named with its number.
  const byText = new Map<string, Found[]>();
  for (const item of found) byText.set(item.textKey, [...(byText.get(item.textKey) ?? []), item]);

  let filed = 0;
  let skipped = 0;
  for (const copies of byText.values()) {
    copies.sort(
      (a, b) =>
        Number(Boolean(registroFromName(b.name))) - Number(Boolean(registroFromName(a.name))) ||
        b.mtime - a.mtime
    );
    const [chosen] = copies;
    const registro = registroFromName(chosen.name) ?? chosen.parsed.registro;
    const type = chosen.parsed.type;
    const label = certificateDisplayName(type ?? "?", registro, chosen.ext);

    if (!type) {
      console.log(`  ?  sin tipo reconocible: ${chosen.file}`);
      continue;
    }

    const sha256 = crypto.createHash("sha256").update(chosen.bytes).digest("hex");
    if (findCertificateByHash(sha256)) {
      skipped++;
      continue;
    }

    const ref = resolveCertificateRef(registro);
    const notes = reviewNotes(chosen, registro, ref);
    const extra = copies.length > 1 ? ` (+${copies.length - 1} copia(s) idéntica(s))` : "";
    console.log(`  ${ref ? "✓" : "·"}  ${label}${ref ? `  → ficha ${ref}` : ""}${extra}`);
    for (const note of notes) console.log(`       ! ${note}`);
    if (dryRun) continue;

    const certificate = addArchivedCertificate({
      ref,
      registro,
      type,
      party: chosen.parsed.party,
      issuedOn: chosen.parsed.issuedOn,
      artist: chosen.parsed.artist,
      title: chosen.parsed.title,
      edition: chosen.parsed.edition,
      bodyText: chosen.parsed.paragraphs.join("\n"),
      originalName: path.relative(path.resolve(folder), chosen.file),
      notes: notes.join("\n") || null,
      fileExt: chosen.ext,
    });
    const stored = await writeCertificateFile(certificate.id, chosen.ext, chosen.bytes);
    setCertificateFile(certificate.id, { ...stored, ext: chosen.ext });
    filed++;
  }

  if (!dryRun && filed > 0) {
    record({
      actor: SYSTEM_ACTOR,
      action: "archivar certificado",
      entity: "certificado",
      summary: `${filed} certificado(s) de Word importados de ${path.basename(folder)}`,
    });
  }

  console.log(
    `\n${files.length} archivo(s), ${byText.size} certificado(s) distintos · ${
      dryRun ? "simulación, nada guardado" : `${filed} archivados`
    }${skipped ? ` · ${skipped} ya estaban` : ""}`
  );
  closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
