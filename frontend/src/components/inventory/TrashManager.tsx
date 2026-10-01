"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveRestore,
  ArrowUpRight,
  Award,
  Box,
  Building2,
  Clock,
  Copy,
  FileText,
  Frame,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { TRASH_ENTITY_LABELS, type TrashEntity, type TrashItem } from "@/lib/inventory/trash-types";
import { BADGE, BTN, BTN_PRIMARY, BTN_SUBTLE, CARD, FIELD, MUTED } from "./ui";
import { useToast } from "./ToastProvider";
import { copyText, useContextMenu, useMenuConfirm } from "./ContextMenu";
import { trashAction } from "./trash-client";
import { useDateLocale, useTr } from "@/components/I18nProvider";

const ICONS: Record<TrashEntity, LucideIcon> = {
  obra: Frame,
  certificado: Award,
  pagina: FileText,
  imagen: ImageIcon,
  edificio: Building2,
  unidad: Box,
  jornada: Clock,
};

/** Stored UTC by SQLite, shown on the reader's clock. */
function when(at: string, loc: string): string {
  const parsed = new Date(at.includes("T") ? at : `${at.replace(" ", "T")}Z`);
  return parsed.toLocaleString(loc, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TrashManager({ items, canPurge }: { items: TrashItem[]; canPurge: boolean }) {
  const tr = useTr();
  const loc = useDateLocale();
  const router = useRouter();
  const { notify } = useToast();
  const menu = useContextMenu();
  const confirm = useMenuConfirm();
  const [filter, setFilter] = useState<TrashEntity | "todo">("todo");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const result = new Map<TrashEntity, number>();
    for (const item of items) result.set(item.entity, (result.get(item.entity) ?? 0) + 1);
    return result;
  }, [items]);

  const visible = useMemo(() => {
    const words = query.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      if (filter !== "todo" && item.entity !== filter) return false;
      const haystack = [item.label, item.detail, item.deleted_by_name, item.entity_id]
        .join(" ")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }, [items, filter, query]);

  // Selection only counts what is on screen, so a filter never acts on hidden rows.
  const chosen = visible.filter((item) => selected.has(item.id));
  const allChosen = visible.length > 0 && chosen.length === visible.length;

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function restore(list: TrashItem[], open = false) {
    setBusy(true);
    let done = 0;
    let href: string | null = null;
    for (const item of list) {
      try {
        href = (await trashAction("restore", item.id)).href;
        done++;
      } catch (error) {
        notify(`${item.label}: ${tr((error as Error).message)}`, "error");
      }
    }
    setBusy(false);
    setSelected(new Set());
    if (done === 0) return;
    const target = href;
    notify(
      done === 1 ? tr("«{label}» restaurado", { label: list[0].label }) : tr("{n} elementos restaurados", { n: done }),
      "success",
      done === 1 && target && !open ? { label: tr("Abrir"), run: () => router.push(target) } : undefined
    );
    if (open && target) router.push(target);
    else router.refresh();
  }

  async function purge(list: TrashItem[]) {
    const ok = await confirm({
      title:
        list.length === 1
          ? tr("¿Eliminar «{label}» para siempre?", { label: list[0].label })
          : tr("¿Eliminar {n} elementos para siempre?", { n: list.length }),
      body: tr("Se borran de la papelera junto con sus archivos. Esto no se puede deshacer."),
      confirmLabel: tr("Eliminar definitivamente"),
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    let done = 0;
    for (const item of list) {
      try {
        await trashAction("purge", item.id);
        done++;
      } catch (error) {
        notify(`${item.label}: ${tr((error as Error).message)}`, "error");
      }
    }
    setBusy(false);
    setSelected(new Set());
    if (done) notify(tr("{n} eliminado(s) definitivamente", { n: done }));
    router.refresh();
  }

  const chip = (value: TrashEntity | "todo", label: string, count: number) => (
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
      {label} <span className={MUTED}>{count}</span>
    </button>
  );

  if (items.length === 0) {
    return (
      <div className={`${CARD} px-6 py-16 text-center`}>
        <Trash2 size={28} strokeWidth={1.5} className="mx-auto text-[var(--ink-4)]" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-[var(--ink-1)]">{tr("La papelera está vacía")}</p>
        <p className={`mt-1 text-sm ${MUTED}`}>{tr("Lo que se elimine aparecerá aquí y se podrá restaurar.")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("Buscar en la papelera…")}
          className={`${FIELD} max-w-[360px]`}
        />
        <div className="ml-auto flex items-center gap-2">
          {chosen.length > 0 && (
            <>
              <span className={`text-sm ${MUTED}`}>{tr("{n} seleccionado(s)", { n: chosen.length })}</span>
              {canPurge && (
                <button type="button" className={BTN} disabled={busy} onClick={() => purge(chosen)}>
                  <Trash2 size={15} strokeWidth={1.75} aria-hidden />
                  {tr("Eliminar definitivamente")}
                </button>
              )}
              <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => restore(chosen)}>
                <ArchiveRestore size={15} strokeWidth={1.75} aria-hidden />
                {tr("Restaurar")}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {chip("todo", tr("Todo"), items.length)}
        {(Object.keys(TRASH_ENTITY_LABELS) as TrashEntity[])
          .filter((entity) => counts.get(entity))
          .map((entity) => chip(entity, tr(TRASH_ENTITY_LABELS[entity]), counts.get(entity) ?? 0))}
      </div>

      <div className={`${CARD} mt-4 overflow-hidden`}>
        <div className="flex items-center gap-3 border-b border-[var(--stroke)] bg-[var(--surface-alt)] px-4 py-2 text-xs font-semibold text-[var(--ink-2)]">
          <input
            type="checkbox"
            checked={allChosen}
            onChange={() => setSelected(allChosen ? new Set() : new Set(visible.map((item) => item.id)))}
            aria-label={tr("Seleccionar todo")}
            className="size-4 accent-[var(--brand)]"
          />
          <span className="flex-1">{tr("Elemento")}</span>
          <span className="hidden w-[220px] md:block">{tr("Eliminado")}</span>
          <span className="w-[200px]" />
        </div>

        {visible.length === 0 && <p className={`px-4 py-8 text-center text-sm ${MUTED}`}>{tr("Nada coincide.")}</p>}

        <ul className="divide-y divide-[var(--stroke-soft)]">
          {visible.map((item) => {
            const Icon = ICONS[item.entity] ?? Trash2;
            return (
              <li
                key={item.id}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  selected.has(item.id) ? "bg-[var(--selected)]" : "hover:bg-[var(--hover)]"
                }`}
                onDoubleClick={(event) => {
                  if (!(event.target as Element).closest("button, input")) void restore([item], true);
                }}
                onContextMenu={menu(() => [
                  { label: tr("Restaurar"), icon: ArchiveRestore, disabled: busy, run: () => restore([item]) },
                  { label: tr("Restaurar y abrir"), icon: ArrowUpRight, disabled: busy, run: () => restore([item], true) },
                  "separator",
                  { label: tr("Copiar nombre"), icon: Copy, run: () => copyText(item.label) },
                  canPurge && "separator",
                  canPurge && {
                    label: tr("Eliminar definitivamente…"),
                    icon: Trash2,
                    danger: true,
                    disabled: busy,
                    run: () => purge([item]),
                  },
                ])}
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  aria-label={tr("Seleccionar {label}", { label: item.label })}
                  className="size-4 accent-[var(--brand)]"
                />
                <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius)] bg-[var(--surface-alt)] text-[var(--ink-2)]">
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-semibold text-[var(--ink-1)]">{item.label}</span>
                    <span className={BADGE.neutral}>{tr(TRASH_ENTITY_LABELS[item.entity] ?? item.entity)}</span>
                    {item.files > 0 && (
                      <span className={BADGE.neutral} title={tr("Archivos guardados con el registro")}>
                        <Paperclip size={11} className="mr-1" aria-hidden />
                        {item.files}
                      </span>
                    )}
                  </span>
                  {item.detail && <span className={`mt-0.5 block truncate text-xs ${MUTED}`}>{item.detail}</span>}
                </span>
                <span className={`hidden w-[220px] text-xs md:block ${MUTED}`}>
                  {when(item.deleted_at, loc)}
                  {item.deleted_by_name && (
                    <span className="block truncate">{tr("por {name}", { name: tr(item.deleted_by_name) })}</span>
                  )}
                </span>
                <span className="flex w-[200px] justify-end gap-1">
                  {canPurge && (
                    <button
                      type="button"
                      className={`${BTN_SUBTLE} text-[var(--danger)]`}
                      disabled={busy}
                      onClick={() => purge([item])}
                      title={tr("Eliminar definitivamente")}
                    >
                      <Trash2 size={15} strokeWidth={1.75} aria-hidden />
                      <span className="sr-only">{tr("Eliminar definitivamente")}</span>
                    </button>
                  )}
                  <button type="button" className={BTN} disabled={busy} onClick={() => restore([item])}>
                    <ArchiveRestore size={15} strokeWidth={1.75} aria-hidden />
                    {tr("Restaurar")}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
