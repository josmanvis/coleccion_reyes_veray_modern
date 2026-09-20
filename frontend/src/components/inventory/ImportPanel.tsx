"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ImportSummary = {
  inserted: number;
  updated: number;
  skipped: number;
  unknownColumns: string[];
  errors: string[];
  images: { linked: number; unmatched: number };
  filename: string;
};

export default function ImportPanel() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;

    setPending(true);
    setError(null);
    setSummary(null);

    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/admin/import", { method: "POST", body });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      setSummary(data);
      router.refresh();
    } else {
      setError(data.error || "No se pudo importar el archivo");
    }
    setPending(false);
  }

  return (
    <>
      <h2 className="border-b border-neutral-200 pb-1.5 text-xs uppercase tracking-wide text-neutral-500">
        Importar hoja de cálculo
      </h2>

      <form onSubmit={upload} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <input
          type="file"
          accept=".xlsx,.xlsm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="max-w-[280px] text-xs file:mr-3 file:rounded file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:text-black hover:file:border-neutral-600"
        />
        <button
          type="submit"
          disabled={!file || pending}
          className="rounded bg-black px-3 py-1.5 text-white transition hover:bg-neutral-700 disabled:opacity-40"
        >
          {pending ? "Importando…" : "Importar"}
        </button>
      </form>

      <p className="mt-2 text-xs text-neutral-500">
        Las filas se combinan por <span className="font-mono">#&nbsp;Registro</span>: las existentes
        se actualizan y las nuevas se agregan. Nada se borra.
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p>
            {summary.filename}: {summary.inserted} nuevas · {summary.updated} actualizadas
            {summary.skipped > 0 && ` · ${summary.skipped} omitidas`}
          </p>
          <p className="mt-0.5 text-xs text-emerald-800">
            Imágenes enlazadas: {summary.images.linked} · sin imagen: {summary.images.unmatched}
          </p>
          {summary.unknownColumns.length > 0 && (
            <p className="mt-1 text-xs text-emerald-800">
              Columnas ignoradas: {summary.unknownColumns.join(", ")}
            </p>
          )}
          {summary.errors.length > 0 && (
            <p className="mt-1 text-xs text-red-700">{summary.errors.slice(0, 3).join(" · ")}</p>
          )}
        </div>
      )}
    </>
  );
}
