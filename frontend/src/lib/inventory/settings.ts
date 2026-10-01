import { getDb } from "./db";

/**
 * Application settings.
 *
 * A key/value table rather than more columns: these are a handful of
 * preferences read occasionally, and keeping them out of the schema means
 * adding one costs a constant, not a migration.
 */

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

let ready = false;

function db() {
  const handle = getDb();
  if (!ready) {
    handle.exec(CREATE_SQL);
    ready = true;
  }
  return handle;
}

export const SETTING_DEFAULTS = {
  /** Printed under the signature line on every certificate. */
  "certificate.signatory": "Otto Octavio Reyes Casanova",
  "certificate.collection": "Colección Reyes Veray",
  /** Sent straight to this printer when CRVMGMT prints a certificate. */
  "print.defaultPrinter": "",
  /** Remembered so the sync screen does not ask every time. */
  "filemaker.filePath": "",
  "filemaker.database": "",
  "filemaker.odbcConnection": "",
  "filemaker.odbcTable": "",
  /** Suggested-price rules; see lib/inventory/valuation-rules.ts. Percentages as written, e.g. "8". */
  "valuation.annualRate": "8",
  "valuation.deathMultiplier": "2",
  "valuation.hotMultiplier": "1.5",
  "valuation.recentYears": "5",
  "valuation.hotMinSales": "3",
  "valuation.hotGrowth": "15",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export type Settings = Record<SettingKey, string>;

export function readSettings(): Settings {
  const rows = db().prepare("SELECT key, value FROM settings").all() as Array<{
    key: string;
    value: string;
  }>;
  const stored = new Map(rows.map((row) => [row.key, row.value]));

  return Object.fromEntries(
    (Object.keys(SETTING_DEFAULTS) as SettingKey[]).map((key) => [
      key,
      stored.get(key) ?? SETTING_DEFAULTS[key],
    ])
  ) as Settings;
}

export function readSetting(key: SettingKey): string {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? SETTING_DEFAULTS[key];
}

/** Unknown keys are ignored rather than stored, so the table stays a known set. */
export function writeSettings(patch: Record<string, unknown>): Settings {
  const handle = db();
  const upsert = handle.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (@key, @value, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = datetime('now')`
  );

  handle.transaction(() => {
    for (const [key, value] of Object.entries(patch)) {
      if (!(key in SETTING_DEFAULTS)) continue;
      upsert.run({ key, value: value === null || value === undefined ? "" : String(value) });
    }
  })();

  return readSettings();
}
