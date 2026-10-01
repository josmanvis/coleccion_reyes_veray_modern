"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpRight, ChevronDown, ChevronRight, Copy, Download, Eye, Hash, Pencil, Trash2, Upload } from "lucide-react";
import type { CertificateRecord } from "@/lib/inventory/certificate-log";
import {
  CERTIFICATE_COPY,
  CERTIFICATE_TYPES,
  certificateDisplayName,
  spanishDate,
  type CertificateType,
} from "@/lib/inventory/certificates";
import { BADGE, BTN, BTN_PRIMARY, BTN_SUBTLE, CARD, FIELD, LABEL, MUTED } from "./ui";
import { useToast } from "./ToastProvider";
import ConfirmDialog from "./ConfirmDialog";
import { useTr } from "@/components/I18nProvider";
import { copyText, download, useContextMenu } from "./ContextMenu";
import CertificateViewer from "./CertificateViewer";
import { useDeletedToast } from "./trash-client";

export type CertificateRow = CertificateRecord & {
  /** The linked ficha, for the "Obra" column. */
  artwork: { ref: string; artist: string; title: string } | null;
};

type Filter = "todos" | CertificateType | "revisar";

function typeLabel(type: string, tr: (es: string) => string): string {
  const word = tr((CERTIFICATE_COPY[type as CertificateType]?.heading ?? type).replace("Certificado de ", ""));
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function sortKey(registro: string | null): string {
  // 0754b and 1254.a sort beside their number, not after 9999.
  return (registro ?? "~").padStart(4, "0");
}

/**
 * The register of every certificate: the Word files issued before the app and
 * the PDFs it generates. Each is named "Certificado de <tipo> CRV <número>" from
 * its type and number, so fixing either renames it.
 */
export default function CertificatesManager({ rows }: { rows: CertificateRow[] }) {
  const tr = useTr();
  const router = useRouter();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [order, setOrder] = useState<"fecha" | "crv">("fecha");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<CertificateRow | null>(null);
  const [removing, setRemoving] = useState<CertificateRow | null>(null);
  const [busy, setBusy] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const menu = useContextMenu();
  const [viewing, setViewing] = useState<number | null>(null);
  const deletedToast = useDeletedToast();

  const needsReview = (row: CertificateRow) => Boolean(row.notes) || !row.ref;

  // Two different certificates under one name (a corrected re-issue) are
  // numbered, so it is clear which is which.
  const versions = useMemo(() => {
    const byName = new Map<string, CertificateRow[]>();
    for (const row of rows) {
      const name = certificateDisplayName(row.type, row.registro);
      byName.set(name, [...(byName.get(name) ?? []), row]);
    }
    const result = new Map<number, string>();
    for (const group of byName.values()) {
      if (group.length < 2) continue;
      [...group]
        .sort((a, b) => a.id - b.id)
        .forEach((row, index) => result.set(row.id, tr("versión {v} de {length}", { v: index + 1, length: group.length })));
    }
    return result;
  }, [rows]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { todos: rows.length, revisar: rows.filter(needsReview).length };
    for (const type of CERTIFICATE_TYPES) result[type] = rows.filter((r) => r.type === type).length;
    return result;
  }, [rows]);

  const visible = useMemo(() => {
    const words = query
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const list = rows.filter((row) => {
      if (filter === "revisar" ? !needsReview(row) : filter !== "todos" && row.type !== filter) return false;
      if (!words.length) return true;
      const haystack = [
        certificateDisplayName(row.type, row.registro),
        row.registro,
        row.party,
        row.artist,
        row.title,
        row.artwork?.artist,
        row.artwork?.title,
        row.code,
        row.original_name,
      ]
        .join(" ")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
    if (order === "crv") list.sort((a, b) => sortKey(a.registro).localeCompare(sortKey(b.registro)));
    return list;
  }, [rows, query, filter, order]);

  // The viewer steps through the list as filtered, so ← → follow what is on screen.
  const viewIndex = viewing === null ? -1 : visible.findIndex((row) => row.id === viewing);
  const viewed = viewIndex >= 0 ? visible[viewIndex] : null;

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    let added = 0;
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/certificates", { method: "POST", body: form });
      if (response.ok) {
        added++;
      } else {
        const body = await response.json().catch(() => ({}));
        notify(`${file.name}: ${tr(body.error || "no se pudo guardar")}`, "error");
      }
    }
    if (added) notify(tr("{n} certificado(s) guardado(s)", { n: added }));
    if (upload.current) upload.current.value = "";
    setBusy(false);
    router.refresh();
  }

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch(`/api/admin/certificates/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      notify(tr(body.error || "No se pudo guardar"), "error");
      return;
    }
    const updated = (await response.json()) as CertificateRecord;
    notify(tr("Guardado como {name}", { name: certificateDisplayName(updated.type, updated.registro) }));
    setEditing(null);
    router.refresh();
  }

  async function onDelete() {
    if (!removing) return;
    setBusy(true);
    const response = await fetch(`/api/admin/certificates/${removing.id}`, { method: "DELETE" });
    setBusy(false);
    if (response.ok) {
      const { trashId } = await response.json().catch(() => ({}));
      deletedToast(tr("Certificado enviado a la papelera"), trashId);
      router.refresh();
    } else {
      notify(tr("No se pudo eliminar"), "error");
    }
    setRemoving(null);
  }

  const chip = (value: Filter, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setFilter(value)}
      aria-pressed={filter === value}
      className={`rounded-[var(--radius)] border px-2.5 py-1 text-sm transition-colors ${
        filter === value
          ? "border-[var(--brand)] bg-[var(--brand-soft)] font-semibold text-[var(--ink-1)]"
          : "border-[var(--stroke)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
      }`}
    >
      {label} <span className={MUTED}>{counts[value]}</span>
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("Buscar por CRV, artista, título o persona…")}
          className={`${FIELD} max-w-[360px]`}
        />
        <select
          value={order}
          onChange={(e) => setOrder(e.target.value as "fecha" | "crv")}
          className={`${FIELD} w-auto`}
          aria-label={tr("Ordenar")}
        >
          <option value="fecha">{tr("Más recientes")}</option>
          <option value="crv">{tr("Por número CRV")}</option>
        </select>
        <div className="ml-auto">
          <input
            ref={upload}
            type="file"
            accept=".docx,.pdf"
            multiple
            hidden
            onChange={(e) => onUpload(e.target.files)}
          />
          <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => upload.current?.click()}>
            <Upload size={15} strokeWidth={1.75} aria-hidden />
            {busy ? tr("Guardando…") : tr("Subir certificado")}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {chip("todos", tr("Todos"))}
        {CERTIFICATE_TYPES.map((type) => chip(type, typeLabel(type, tr)))}
        {counts.revisar > 0 && chip("revisar", tr("Por revisar"))}
      </div>

      <div className={`${CARD} mt-4 overflow-hidden`}>
        {visible.length === 0 && <p className={`px-4 py-8 text-center text-sm ${MUTED}`}>{tr("Ningún certificado coincide.")}</p>}
        <ul className="divide-y divide-[var(--stroke-soft)]">
          {visible.map((row) => {
            const open = expanded === row.id;
            const name = certificateDisplayName(row.type, row.registro);
            const artwork = row.artwork;
            return (
              <li key={row.id}>
                <div
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm"
                  onDoubleClick={(event) => {
                    if ((event.target as Element).closest("a, button:not([aria-expanded])")) return;
                    setViewing(row.id);
                  }}
                  onContextMenu={menu(() => [
                    { label: tr("Ver certificado"), icon: Eye, run: () => setViewing(row.id) },
                    {
                      label: open ? tr("Ocultar detalles") : tr("Mostrar detalles"),
                      icon: open ? ChevronDown : ChevronRight,
                      run: () => setExpanded(open ? null : row.id),
                    },
                    row.file_name && {
                      label: tr("Descargar"),
                      icon: Download,
                      run: () => download(`/api/admin/certificates/${row.id}/file`),
                    },
                    artwork && {
                      label: tr("Abrir ficha"),
                      icon: ArrowUpRight,
                      run: () => router.push(`/inventory/${encodeURIComponent(artwork.ref)}`),
                    },
                    "separator",
                    { label: tr("Editar…"), icon: Pencil, run: () => setEditing(row) },
                    { label: tr("Copiar nombre"), icon: Copy, run: () => copyText(name) },
                    row.registro && {
                      label: tr("Copiar número CRV"),
                      icon: Hash,
                      run: () => copyText(row.registro ?? ""),
                    },
                    "separator",
                    { label: tr("Eliminar…"), icon: Trash2, danger: true, run: () => setRemoving(row) },
                  ])}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : row.id)}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 basis-[320px] items-start gap-2 text-left"
                  >
                    {open ? (
                      <ChevronDown size={16} className="mt-0.5 shrink-0 text-[var(--ink-3)]" aria-hidden />
                    ) : (
                      <ChevronRight size={16} className="mt-0.5 shrink-0 text-[var(--ink-3)]" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-[var(--ink-1)]">{name}</span>
                        {row.file_ext && <span className={BADGE.neutral}>{row.file_ext.toUpperCase()}</span>}
                        {row.source === "generado" && <span className={BADGE.brand}>{row.code}</span>}
                        {versions.get(row.id) && <span className={BADGE.neutral}>{versions.get(row.id)}</span>}
                        {needsReview(row) && (
                          <span className={BADGE.warning}>
                            <AlertTriangle size={12} className="mr-1" aria-hidden />
                            
                            {tr("Revisar")}
                          </span>
                        )}
                      </span>
                      <span className={`mt-0.5 block truncate text-xs ${MUTED}`}>
                        {[row.artwork?.artist ?? row.artist, row.artwork?.title ?? row.title].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>

                  <span className="w-[220px] truncate text-[var(--ink-2)]" title={row.party ?? ""}>
                    {row.party || <span className={MUTED}>—</span>}
                  </span>
                  <span className={`w-[150px] text-xs ${MUTED}`}>
                    {row.issued_on ? spanishDate(row.issued_on) : tr("Sin fecha")}
                  </span>

                  <span className="ml-auto flex items-center gap-1">
                    <button type="button" className={BTN_SUBTLE} onClick={() => setViewing(row.id)} title={tr("Ver certificado")}>
                      <Eye size={15} strokeWidth={1.75} aria-hidden />
                      <span className="sr-only">{tr("Ver certificado")}</span>
                    </button>
                    {row.file_name ? (
                      <a
                        href={`/api/admin/certificates/${row.id}/file`}
                        className={BTN_SUBTLE}
                        title={tr("Descargar {file}", { file: `${name}.${row.file_ext}` })}
                      >
                        <Download size={15} strokeWidth={1.75} aria-hidden />
                        <span className="sr-only">{tr("Descargar")}</span>
                      </a>
                    ) : (
                      <span className={`px-2 text-xs ${MUTED}`} title={tr("Emitido antes de que se guardaran los archivos")}>
                        
                        {tr("sin archivo")}
                      </span>
                    )}
                    <button type="button" className={BTN_SUBTLE} onClick={() => setEditing(row)} title={tr("Editar")}>
                      <Pencil size={15} strokeWidth={1.75} aria-hidden />
                      <span className="sr-only">{tr("Editar")}</span>
                    </button>
                    <button type="button" className={BTN_SUBTLE} onClick={() => setRemoving(row)} title={tr("Eliminar")}>
                      <Trash2 size={15} strokeWidth={1.75} aria-hidden />
                      <span className="sr-only">{tr("Eliminar")}</span>
                    </button>
                  </span>
                </div>

                {open && (
                  <div className="grid gap-4 border-t border-[var(--stroke-soft)] bg-[var(--surface-alt)] px-9 py-3 text-sm md:grid-cols-[1fr_280px]">
                    <div>
                      {row.notes && (
                        <p className="mb-3 whitespace-pre-line rounded-[var(--radius)] border border-[color:var(--warning)]/30 bg-[var(--warning-soft)] px-3 py-2 text-[var(--ink-1)]">
                          {row.notes}
                        </p>
                      )}
                      {row.body_text ? (
                        <pre className="whitespace-pre-wrap font-[inherit] text-[var(--ink-2)]">{row.body_text}</pre>
                      ) : (
                        <p className={MUTED}>{tr("Generado por la app; descarga el PDF para verlo.")}</p>
                      )}
                    </div>
                    <dl className="space-y-1.5 text-xs">
                      <div>
                        <dt className={MUTED}>{tr("Ficha")}</dt>
                        <dd>
                          {row.artwork ? (
                            <Link href={`/inventory/${encodeURIComponent(row.artwork.ref)}`} className="text-[var(--brand)] hover:underline">
                              {row.artwork.ref} · {row.artwork.title}
                            </Link>
                          ) : (
                            tr("Sin enlazar")
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className={MUTED}>{tr("Origen")}</dt>
                        <dd>{row.source === "generado" ? tr("Generado en la app ({code})", { code: row.code }) : tr("Word, archivo existente")}</dd>
                      </div>
                      {row.original_name && (
                        <div>
                          <dt className={MUTED}>{tr("Archivo original")}</dt>
                          <dd className="break-words">{row.original_name}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label={tr("Cerrar")} onClick={() => setEditing(null)} className="absolute inset-0 cursor-default bg-black/20" />
          <form
            onSubmit={onSave}
            role="dialog"
            aria-modal="true"
            aria-label={tr("Editar certificado")}
            className={`${CARD} relative w-full max-w-[480px] p-5`}
          >
            <h2 className="text-base font-semibold">{tr("Editar certificado")}</h2>
            <p className={`mt-1 text-xs ${MUTED}`}>
              {tr("El nombre se forma con el tipo y el número: «Certificado de <tipo> CRV <número>».")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <span className={LABEL}>{tr("Tipo")}</span>
                <select name="type" defaultValue={editing.type} className={FIELD}>
                  {CERTIFICATE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {typeLabel(type, tr)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={LABEL}>{tr("Número CRV")}</span>
                <input name="registro" defaultValue={editing.registro ?? ""} placeholder={tr("1254.a")} className={FIELD} />
              </label>
              <label className="sm:col-span-2">
                <span className={LABEL}>{tr("Persona o entidad")}</span>
                <input name="party" defaultValue={editing.party ?? ""} className={FIELD} />
              </label>
              <label>
                <span className={LABEL}>{tr("Fecha otorgado")}</span>
                <input type="date" name="issued_on" defaultValue={editing.issued_on ?? ""} className={FIELD} />
              </label>
              <label className="sm:col-span-2">
                <span className={LABEL}>{tr("Notas (vacío para marcarlo como revisado)")}</span>
                <textarea name="notes" defaultValue={editing.notes ?? ""} rows={3} className={FIELD} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={BTN} onClick={() => setEditing(null)}>
                
                {tr("Cancelar")}
              </button>
              <button type="submit" className={BTN_PRIMARY} disabled={busy}>
                {busy ? tr("Guardando…") : tr("Guardar")}
              </button>
            </div>
          </form>
        </div>
      )}

      <CertificateViewer
        certificate={
          viewed && {
            id: viewed.id,
            name: certificateDisplayName(viewed.type, viewed.registro),
            ext: viewed.file_ext,
            hasFile: Boolean(viewed.file_name),
            bodyText: viewed.body_text,
          }
        }
        position={viewed ? tr("{n} de {total}", { n: viewIndex + 1, total: visible.length }) : undefined}
        onClose={() => setViewing(null)}
        onPrevious={viewIndex > 0 ? () => setViewing(visible[viewIndex - 1].id) : undefined}
        onNext={viewIndex >= 0 && viewIndex < visible.length - 1 ? () => setViewing(visible[viewIndex + 1].id) : undefined}
      />

      <ConfirmDialog
        open={removing !== null}
        title={tr("¿Eliminar este certificado?")}
        body={tr("Sale del registro y va a la papelera con su archivo; se puede restaurar desde allí.")}
        detail={removing ? certificateDisplayName(removing.type, removing.registro) : null}
        confirmLabel={tr("Eliminar")}
        tone="danger"
        pending={busy}
        onConfirm={onDelete}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
