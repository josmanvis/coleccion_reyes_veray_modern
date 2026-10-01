"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import { BTN, BTN_DANGER, BTN_PRIMARY, CARD, FIELD, LABEL, MUTED } from "./ui";
import { useToast } from "./ToastProvider";
import ConfirmDialog from "./ConfirmDialog";

type Status = { mode: string; available: boolean; detail: string };
type Field = {
  id: number;
  registro: string;
  title: string | null;
  label: string;
  app_value: string;
  fm_value: string;
  kind: "both" | "only_filemaker" | "only_app";
  decision: "undecided" | "use_filemaker" | "use_app" | "skip";
  applied_at: string | null;
};
type Run = {
  id: number;
  mode: string;
  source: string | null;
  counts: { fields: number; records: number; undecided: number; inbound: number; outbound: number; applied: number };
};

const KIND_LABEL: Record<Field["kind"], string> = {
  both: "Difiere",
  only_filemaker: "Solo en FileMaker",
  only_app: "Solo en CRVMGMT",
};

/**
 * Two-way review against FileMaker. Every differing field shows both values and
 * starts undecided — writing in either direction only happens for the fields
 * given a direction here.
 */
const subscribeNever = () => () => {};

export default function SyncReview({
  initial,
}: {
  /** Status and any open comparison, read on the server so the screen renders
      complete instead of fetching itself into existence. */
  initial: {
    applescript: Status;
    odbc: Status;
    databases: string[];
    run: Run | null;
    fields: Field[];
  };
}) {
  const router = useRouter();
  // Present only inside CRVMGMT; read as an external value so it is correct on
  // the first client render without writing state from an effect.
  const desktop = useSyncExternalStore(
    subscribeNever,
    () => Boolean((window as unknown as { crvmgmt?: unknown }).crvmgmt),
    () => false
  );
  const { notify } = useToast();

  const [applescript, setApplescript] = useState<Status | null>(initial.applescript);
  const [odbc, setOdbc] = useState<Status | null>(initial.odbc);
  const [databases, setDatabases] = useState<string[]>(initial.databases);
  const [database, setDatabase] = useState(initial.databases[0] ?? "");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [connectionString, setConnectionString] = useState("");
  const [table, setTable] = useState("");
  const [run, setRun] = useState<Run | null>(initial.run);
  const [fields, setFields] = useState<Field[]>(initial.fields);
  const [pending, setPending] = useState(false);
  const [asking, setAsking] = useState(false);

  const refresh = useCallback(async (conn?: string) => {
    const query = conn ? `?connectionString=${encodeURIComponent(conn)}` : "";
    const response = await fetch(`/api/admin/filemaker${query}`);
    if (!response.ok) return;
    const data = await response.json();
    setApplescript(data.applescript);
    setOdbc(data.odbc);
    setDatabases(data.databases ?? []);
    setRun(data.run);
    setFields(data.fields ?? []);
    setDatabase((current) => current || data.databases?.[0] || "");
  }, []);

  /**
   * Picks an .fmp12 and asks FileMaker to open it. Reading needs an open
   * database, so choosing a file and opening it is a single step.
   */
  async function chooseFile() {
    const shell = (window as unknown as {
      crvmgmt?: { chooseFile: (f: unknown) => Promise<{ path: string; name: string } | null> };
    }).crvmgmt;
    if (!shell) return;

    const picked = await shell.chooseFile([
      { name: "FileMaker Pro", extensions: ["fmp12", "fmpur"] },
    ]);
    if (!picked) return;

    setFilePath(picked.path);
    setPending(true);
    const response = await fetch("/api/admin/filemaker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "open", path: picked.path }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setDatabases(data.databases ?? []);
      setDatabase(data.databases?.[0] ?? "");
      notify(`${picked.name} abierto en FileMaker`);
      await refresh();
    } else {
      notify(data.error || "FileMaker no pudo abrir el archivo", "error");
    }
    setPending(false);
  }

  async function post(payload: Record<string, unknown>, done?: string) {
    setPending(true);
    const response = await fetch("/api/admin/filemaker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      if (done) notify(done);
      await refresh();
      router.refresh();
    } else {
      notify(data.error || "No se pudo completar", "error");
    }
    setPending(false);
    setAsking(false);
    return data;
  }

  if (!desktop) {
    return (
      <div className={`${CARD} flex items-start gap-3 p-4`}>
        <AlertTriangle size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 text-[var(--warning)]" />
        <div>
          <h2 className="text-sm font-semibold">Solo disponible en la app de escritorio</h2>
          <p className={`mt-1 text-sm ${MUTED}`}>
            La conexión con FileMaker Pro necesita acceso al sistema, que el navegador no permite.
            Abre CRVMGMT para sincronizar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className={`${CARD} p-4`}>
        <h2 className="text-sm font-semibold">Conexión con FileMaker Pro</h2>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-[var(--radius)] border border-[var(--stroke-soft)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">AppleScript</p>
              <button type="button" onClick={chooseFile} disabled={pending} className={BTN}>
                <FolderOpen size={15} strokeWidth={1.75} aria-hidden />
                Elegir archivo…
              </button>
            </div>
            {filePath && (
              <p className={`mt-1 truncate font-mono text-[11px] ${MUTED}`} title={filePath}>
                {filePath}
              </p>
            )}
            <p className={`mt-1 text-xs ${applescript?.available ? "text-[var(--success)]" : MUTED}`}>
              {applescript?.detail ?? "Comprobando…"}
            </p>
            {databases.length > 0 && (
              <label className="mt-2 block">
                <span className={LABEL}>Archivo de FileMaker a usar</span>
                <select value={database} onChange={(e) => setDatabase(e.target.value)} className={FIELD}>
                  {databases.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--stroke-soft)] p-3">
            <p className="text-sm font-semibold">ODBC</p>
            <p className={`mt-1 text-xs ${odbc?.available ? "text-[var(--success)]" : MUTED}`}>
              {odbc?.detail ?? "Comprobando…"}
            </p>
            <label className="mt-2 block">
              <span className={LABEL}>Cadena de conexión</span>
              <input
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                onBlur={() => refresh(connectionString)}
                placeholder="DSN=CRV;UID=admin;PWD=…"
                className={FIELD}
              />
            </label>
            <label className="mt-2 block">
              <span className={LABEL}>Tabla</span>
              <input value={table} onChange={(e) => setTable(e.target.value)} className={FIELD} />
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!applescript?.available || !database || pending}
            onClick={() => post({ action: "compare", mode: "applescript", database }, "Comparación lista")}
            className={BTN_PRIMARY}
          >
            <RefreshCw size={15} strokeWidth={1.75} aria-hidden />
            Comparar por AppleScript
          </button>
          <button
            type="button"
            disabled={!odbc?.available || !table || pending}
            onClick={() =>
              post({ action: "compare", mode: "odbc", connectionString, table }, "Comparación lista")
            }
            className={BTN}
          >
            <RefreshCw size={15} strokeWidth={1.75} aria-hidden />
            Comparar por ODBC
          </button>
        </div>
      </section>

      {run && (
        <section className={CARD}>
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--stroke-soft)] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">
                {run.counts.fields} diferencias en {run.counts.records} obras
              </h2>
              <p className={`mt-0.5 text-xs ${MUTED}`}>
                {run.counts.undecided} sin decidir · {run.counts.inbound} hacia CRVMGMT ·{" "}
                {run.counts.outbound} hacia FileMaker · {run.counts.applied} aplicadas
              </p>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || run.counts.inbound + run.counts.outbound === 0}
                onClick={() => setAsking(true)}
                className={BTN_PRIMARY}
              >
                <Check size={15} strokeWidth={1.75} aria-hidden />
                Aplicar decisiones
              </button>
              <button
                type="button"
                onClick={() => post({ action: "discard", runId: run.id }, "Comparación descartada")}
                className={BTN_DANGER}
              >
                <Trash2 size={15} strokeWidth={1.75} aria-hidden />
                Descartar
              </button>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--stroke)] bg-[var(--surface-alt)] text-left text-xs font-semibold text-[var(--ink-2)]">
                <th className="px-3 py-2">Obra</th>
                <th className="px-3 py-2">Campo</th>
                <th className="px-3 py-2">CRVMGMT</th>
                <th className="px-3 py-2">FileMaker</th>
                <th className="px-3 py-2 text-right">Dirección</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id} className={`border-b border-[var(--stroke-soft)] ${field.applied_at ? "opacity-55" : ""}`}>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-[var(--ink-3)]">{field.registro}</span>
                    <span className="ml-2">{field.title || ""}</span>
                    {field.kind !== "both" && (
                      <span className={`ml-2 text-xs ${MUTED}`}>({KIND_LABEL[field.kind]})</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[var(--ink-2)]">{field.label}</td>
                  <td className="max-w-[220px] truncate px-3 py-2">{field.app_value || "—"}</td>
                  <td className="max-w-[220px] truncate px-3 py-2">{field.fm_value || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        disabled={!!field.applied_at || pending}
                        onClick={() => post({ action: "decide", runId: run.id, ids: [field.id], decision: "use_filemaker" })}
                        className={`rounded-[var(--radius)] border px-2 py-1 text-xs font-semibold transition-colors ${
                          field.decision === "use_filemaker"
                            ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-hover)]"
                            : "border-[var(--stroke)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
                        }`}
                      >
                        ← FileMaker
                      </button>
                      <button
                        type="button"
                        disabled={!!field.applied_at || pending || field.kind !== "both"}
                        onClick={() => post({ action: "decide", runId: run.id, ids: [field.id], decision: "use_app" })}
                        className={`rounded-[var(--radius)] border px-2 py-1 text-xs font-semibold transition-colors ${
                          field.decision === "use_app"
                            ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-hover)]"
                            : "border-[var(--stroke)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
                        }`}
                      >
                        CRVMGMT →
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <ConfirmDialog
        open={asking}
        title="¿Aplicar las decisiones?"
        body="Se escribirá en ambos sistemas según la dirección elegida para cada campo."
        detail={
          run ? (
            <>
              {run.counts.inbound} campo(s) hacia CRVMGMT · {run.counts.outbound} campo(s) escritos en
              el archivo de FileMaker.
            </>
          ) : null
        }
        confirmLabel="Aplicar"
        pending={pending}
        onConfirm={() =>
          post({ action: "apply", runId: run?.id, database, connectionString, table }, "Sincronización aplicada")
        }
        onCancel={() => setAsking(false)}
      />
    </div>
  );
}
