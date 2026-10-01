import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { FIELDS } from "./fields";

const run = promisify(execFile);

/**
 * Reading and writing FileMaker Pro from the desktop app.
 *
 * Two mechanisms, one interface:
 *
 * - **AppleScript** talks to the running copy of FileMaker Pro. It needs the
 *   file's `fmextscriptaccess` extended privilege, which is OFF on
 *   import-tosite.fmp12 — every attempt returns "A privilege violation
 *   occurred" until it is enabled in Manage → Security → Extended Privileges.
 * - **ODBC** connects to the file directly. It needs ODBC/JDBC sharing enabled
 *   in the file and FileMaker's ODBC driver installed.
 *
 * Neither is reachable from a browser, so both are desktop-only. Nothing here
 * writes to FileMaker on its own: `buildOutboundPlan` only describes what would
 * change, and `applyOutbound` runs a plan the owner has already approved.
 */

export type FileMakerMode = "applescript" | "odbc";

export type FileMakerStatus = {
  mode: FileMakerMode;
  available: boolean;
  /** Plain-language reason when it is not, including how to fix it. */
  detail: string;
};

export type FileMakerRecord = Record<string, string | null>;

const APPLESCRIPT_TIMEOUT = 120_000;
/**
 * The status probe has to fail fast: FileMaker can sit unresponsive while it
 * opens a large file, and a page should not block on it.
 */
const PROBE_TIMEOUT = 4_000;

/**
 * execFile puts the useful part on stderr, and reports a timeout as a killed
 * process rather than anything mentioning time.
 */
function errorText(error: unknown): string {
  const e = error as { message?: string; stderr?: string; killed?: boolean; code?: string };
  if (e?.killed || e?.code === "ETIMEDOUT") return "TIMEOUT";
  return [e?.stderr, e?.message].filter(Boolean).join(" ").trim();
}

function privilegeHint(message: string): string {
  if (/privilege violation|-10004/i.test(message)) {
    return (
      "FileMaker rechazó el acceso (privilege violation). Activa el privilegio " +
      "extendido fmextscriptaccess en Archivo → Administrar → Seguridad → " +
      "Configuración avanzada, con una cuenta de acceso completo."
    );
  }
  if (message === "TIMEOUT" || /timed out|ETIMEDOUT/i.test(message)) {
    return (
      "FileMaker Pro no respondió a tiempo. Suele pasar si el archivo sigue " +
      "abriéndose o hay un diálogo esperando en FileMaker."
    );
  }
  if (/Application isn't running|-600/i.test(message)) {
    return "FileMaker Pro no está abierto. Abre el archivo y vuelve a intentar.";
  }
  return message;
}

async function osascript(script: string, timeout = APPLESCRIPT_TIMEOUT): Promise<string> {
  const { stdout } = await run("osascript", ["-e", script], {
    timeout,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.trim();
}

export async function checkAppleScript(): Promise<FileMakerStatus> {
  if (process.platform !== "darwin") {
    return { mode: "applescript", available: false, detail: "AppleScript solo está disponible en macOS." };
  }
  try {
    await osascript('tell application "FileMaker Pro" to get version', PROBE_TIMEOUT);
    // Reading a database is the real test; `version` answers even when the
    // file refuses data access.
    await osascript('tell application "FileMaker Pro" to get name of every database', PROBE_TIMEOUT);
    return { mode: "applescript", available: true, detail: "Conectado a FileMaker Pro." };
  } catch (error) {
    return {
      mode: "applescript",
      available: false,
      detail: privilegeHint(errorText(error)),
    };
  }
}

/** Field name in FileMaker ↔ column key here, from the one field list. */
const BY_COLUMN = new Map(FIELDS.map((f) => [f.column, f.key]));

/**
 * Reads every record of the first table through AppleScript. Cell values come
 * back one record per line, tab-separated, which survives the round trip better
 * than trying to parse AppleScript's own list syntax.
 */
export async function readViaAppleScript(database: string): Promise<FileMakerRecord[]> {
  const fields = [...BY_COLUMN.keys()];
  const fieldList = fields.map((f) => `"${f.replace(/"/g, '\\"')}"`).join(", ");

  const script = `
set fieldNames to {${fieldList}}
set out to ""
tell application "FileMaker Pro"
  tell database "${database.replace(/"/g, '\\"')}"
    set total to count of records
    repeat with i from 1 to total
      set rowText to ""
      repeat with f in fieldNames
        try
          set v to (get cellValue of cell (f as text) of record i) as text
        on error
          set v to ""
        end try
        set rowText to rowText & v & tab
      end repeat
      set out to out & rowText & linefeed
    end repeat
  end tell
end tell
return out`;

  const stdout = await osascript(script);
  return stdout
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const cells = line.split("\t");
      const record: FileMakerRecord = {};
      fields.forEach((field, index) => {
        const key = BY_COLUMN.get(field)!;
        const value = (cells[index] ?? "").trim();
        record[key] = value === "" ? null : value;
      });
      return record;
    });
}

/**
 * Asks FileMaker Pro to open a file. A database has to be open before either
 * mechanism can read it, so choosing a file and opening it is one step.
 */
export async function openDatabase(filePath: string): Promise<string[]> {
  const escaped = filePath.replace(/"/g, '\\"');
  await osascript(
    `tell application "FileMaker Pro" to open POSIX file "${escaped}"`,
    APPLESCRIPT_TIMEOUT
  );
  return listDatabases();
}

export async function listDatabases(): Promise<string[]> {
  const stdout = await osascript(
    'tell application "FileMaker Pro" to get name of every database',
    PROBE_TIMEOUT
  );
  return stdout
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

// --- ODBC --------------------------------------------------------------------

type OdbcModule = {
  connect: (connectionString: string) => Promise<{
    query: (sql: string) => Promise<unknown[]>;
    close: () => Promise<void>;
  }>;
};

/**
 * Loaded lazily and by a computed name: `odbc` is an optional native package
 * that most machines will not have, and a static import would make it a build
 * dependency of the whole app.
 */
async function loadOdbc(): Promise<OdbcModule | null> {
  try {
    const moduleName = "odbc";
    return (await import(/* webpackIgnore: true */ moduleName)) as unknown as OdbcModule;
  } catch {
    return null;
  }
}

export async function checkOdbc(connectionString?: string): Promise<FileMakerStatus> {
  const odbc = await loadOdbc();
  if (!odbc) {
    return {
      mode: "odbc",
      available: false,
      detail:
        "Falta el paquete 'odbc' y/o el driver ODBC de FileMaker. Instala el driver " +
        "y activa Archivo → Compartir → Compartir por ODBC/JDBC.",
    };
  }
  if (!connectionString) {
    return { mode: "odbc", available: false, detail: "Falta la cadena de conexión ODBC." };
  }
  try {
    const connection = await odbc.connect(connectionString);
    await connection.close();
    return { mode: "odbc", available: true, detail: "Conexión ODBC establecida." };
  } catch (error) {
    return { mode: "odbc", available: false, detail: (error as Error).message };
  }
}

export async function readViaOdbc(
  connectionString: string,
  table: string
): Promise<FileMakerRecord[]> {
  const odbc = await loadOdbc();
  if (!odbc) throw new Error("El paquete 'odbc' no está instalado.");

  const connection = await odbc.connect(connectionString);
  try {
    const columns = [...BY_COLUMN.keys()].map((c) => `"${c}"`).join(", ");
    const rows = (await connection.query(`SELECT ${columns} FROM "${table}"`)) as Array<
      Record<string, unknown>
    >;
    return rows.map((row) => {
      const record: FileMakerRecord = {};
      for (const [column, key] of BY_COLUMN) {
        const value = row[column];
        record[key] = value === null || value === undefined || value === "" ? null : String(value);
      }
      return record;
    });
  } finally {
    await connection.close();
  }
}

// --- Writing back, only from an approved plan --------------------------------

export type OutboundEdit = {
  registro: string;
  /** Column name in FileMaker, not the key used here. */
  column: string;
  before: string;
  after: string;
};

/**
 * Applies edits the owner approved. Each edit is a single cell, matched by
 * registro, so a failure affects one field rather than a whole record.
 */
export async function applyOutbound(
  mode: FileMakerMode,
  target: { database?: string; connectionString?: string; table?: string },
  edits: OutboundEdit[]
): Promise<{ applied: number; failed: number; errors: string[] }> {
  const result = { applied: 0, failed: 0, errors: [] as string[] };

  if (mode === "applescript") {
    if (!target.database) throw new Error("Falta el nombre de la base de datos.");
    for (const edit of edits) {
      const script = `
tell application "FileMaker Pro"
  tell database "${target.database.replace(/"/g, '\\"')}"
    set matches to (every record whose cellValue of cell "# Registro" is "${edit.registro}")
    if (count of matches) is 0 then error "registro no encontrado"
    set cellValue of cell "${edit.column.replace(/"/g, '\\"')}" of item 1 of matches to "${edit.after.replace(/"/g, '\\"')}"
  end tell
end tell`;
      try {
        await osascript(script);
        result.applied += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push(`${edit.registro} · ${edit.column}: ${privilegeHint(errorText(error))}`);
      }
    }
    return result;
  }

  const odbc = await loadOdbc();
  if (!odbc) throw new Error("El paquete 'odbc' no está instalado.");
  if (!target.connectionString || !target.table) {
    throw new Error("Falta la cadena de conexión o la tabla.");
  }

  const connection = await odbc.connect(target.connectionString);
  try {
    for (const edit of edits) {
      try {
        await connection.query(
          `UPDATE "${target.table}" SET "${edit.column}" = '${edit.after.replace(/'/g, "''")}' ` +
            `WHERE "# Registro" = '${edit.registro.replace(/'/g, "''")}'`
        );
        result.applied += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push(`${edit.registro} · ${edit.column}: ${(error as Error).message}`);
      }
    }
  } finally {
    await connection.close();
  }
  return result;
}
