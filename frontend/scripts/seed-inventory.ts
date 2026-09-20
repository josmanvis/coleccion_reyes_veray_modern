/**
 * Seeds data/inventory.db from the collection spreadsheet.
 *
 *   npm run inventory:seed -- ../Backup_sept_20_12-23pm.xlsx
 *   npm run inventory:seed -- --reset
 *
 * Re-running is safe: rows are upserted on "# Registro". Pass --reset to start
 * from an empty table instead.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { getDb, closeDb } from "../src/lib/inventory/db";
import { importWorkbook, linkWebsiteImages } from "../src/lib/inventory/import";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const fileArg = args.find((a) => !a.startsWith("--"));
const source = path.resolve(
  process.cwd(),
  fileArg ?? "../../Downloads/importclaude.xlsx"
);

async function main() {
  const buffer = await fs.readFile(source).catch(() => {
    throw new Error(`No se encontró el archivo: ${source}`);
  });

  let db = getDb();
  if (reset) {
    // Drop rather than DELETE so schema changes (new columns) take effect.
    db.exec("DROP TABLE IF EXISTS artworks");
    closeDb();
    db = getDb();
    console.log("Tabla recreada (--reset)");
  }

  console.log(`Importando ${path.basename(source)}…`);
  const result = await importWorkbook(buffer);
  console.log(
    `  ${result.inserted} nuevas · ${result.updated} actualizadas · ${result.skipped} omitidas`
  );
  if (result.unknownColumns.length) {
    console.log(`  Columnas no reconocidas: ${result.unknownColumns.join(", ")}`);
  }
  if (result.errors.length) {
    console.log(`  Errores:\n   - ${result.errors.slice(0, 10).join("\n   - ")}`);
  }

  console.log("Enlazando imágenes del sitio web…");
  const links = await linkWebsiteImages();
  console.log(`  ${links.linked} con imagen · ${links.unmatched} sin imagen`);

  const total = db.prepare("SELECT COUNT(*) AS n FROM artworks").get() as { n: number };
  console.log(`\nListo. ${total.n} obras en la base de datos.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
