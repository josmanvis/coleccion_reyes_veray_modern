"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, ListFilter, Pencil, Trash2 } from "lucide-react";
import { BADGE, BTN, BTN_PRIMARY, CARD, FIELD, LABEL, MUTED } from "./ui";
import { useToast } from "./ToastProvider";
import { useDateLocale, useTr } from "@/components/I18nProvider";
import { useContextMenu } from "./ContextMenu";
import { useDeletedToast } from "./trash-client";

type Shift = {
  id: number;
  userId: number;
  userName: string;
  startedAt: string;
  endedAt: string | null;
  note: string;
  origin: string;
  minutes: number;
  editedByName: string;
  editedAt: string | null;
  editReason: string;
};

type Total = { userId: number; userName: string; shifts: number; minutes: number; open: number };

function hours(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Stored UTC, shown on the reader's clock. */
function day(iso: string, loc: string): string {
  return new Date(iso).toLocaleDateString(loc, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function time(iso: string | null, loc: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
}

/**
 * `datetime-local` works in the browser's zone, while the API speaks UTC with
 * a Z. These two convert between them so a correction typed as "09:00" means
 * nine in the morning here, not in London.
 */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.toISOString().slice(0, 19)}Z`;
}

export default function HoursBoard({
  shifts,
  totals,
  totalMinutes,
  people,
  from,
  to,
  selectedUser,
  canAdjust,
  isAdmin,
  openShiftId,
}: {
  shifts: Shift[];
  totals: Total[];
  totalMinutes: number;
  people: Array<{ id: number; name: string }>;
  from: string;
  to: string;
  selectedUser: number | null;
  canAdjust: boolean;
  isAdmin: boolean;
  openShiftId: number | null;
}) {
  const tr = useTr();
  const loc = useDateLocale();
  const router = useRouter();
  const { notify } = useToast();
  const [editing, setEditing] = useState<Shift | null>(null);
  const [pending, setPending] = useState(false);
  const menu = useContextMenu();
  const deletedToast = useDeletedToast();

  function filter(form: FormData) {
    const query = new URLSearchParams();
    for (const [key, raw] of form.entries()) {
      const text = String(raw).trim();
      if (text) query.set(key, text);
    }
    router.push(`/admin/hours${query.size > 0 ? `?${query}` : ""}`);
  }

  async function submitAdjust(form: FormData) {
    if (!editing) return;
    const reason = String(form.get("reason") ?? "").trim();
    if (!reason) {
      notify(tr("Indica el motivo del ajuste"), "error");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/timeclock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust",
          id: editing.id,
          startedAt: fromLocalInput(String(form.get("startedAt") ?? "")),
          endedAt: fromLocalInput(String(form.get("endedAt") ?? "")),
          note: String(form.get("note") ?? ""),
          reason,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(tr(data.error || "No se pudo ajustar"), "error");
        return;
      }
      notify(tr("Horas ajustadas · queda en el historial"));
      setEditing(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function remove(shift: Shift) {
    const reason = window.prompt(
      tr("Eliminar la jornada de {userName} del {v}.\n\nMotivo (queda registrado):", { userName: shift.userName, v: day(shift.startedAt, loc) })
    );
    if (reason === null) return;
    if (!reason.trim()) {
      notify(tr("Hace falta un motivo"), "error");
      return;
    }

    const response = await fetch("/api/timeclock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: shift.id, reason }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify(tr(data.error || "No se pudo eliminar"), "error");
      return;
    }
    deletedToast(tr("Jornada enviada a la papelera · queda en el historial"), data.trashId);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form action={filter} className={`${CARD} flex flex-wrap items-end gap-3 p-4`}>
        {isAdmin && (
          <label className="min-w-[200px]">
            <span className={LABEL}>{tr("Persona")}</span>
            <select name="user" defaultValue={selectedUser ?? ""} className={FIELD}>
              <option value="">{tr("Todo el equipo")}</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className={LABEL}>{tr("Desde")}</span>
          <input type="date" name="from" defaultValue={from} className={FIELD} />
        </label>
        <label>
          <span className={LABEL}>{tr("Hasta")}</span>
          <input type="date" name="to" defaultValue={to} className={FIELD} />
        </label>
        <button type="submit" className={BTN_PRIMARY}>
          
          {tr("Ver")}
        </button>
        <p className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-[var(--ink-1)]">
          <Clock size={16} strokeWidth={1.75} aria-hidden />
          {tr("{h} en total", { h: hours(totalMinutes) })}
        </p>
      </form>

      {totals.length > 1 && (
        <div className={`${CARD} p-4`}>
          <h2 className="text-sm font-semibold">{tr("Por persona")}</h2>
          <ul className="mt-2 divide-y divide-[var(--stroke-soft)]">
            {totals.map((total) => (
              <li key={total.userId} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="font-medium text-[var(--ink-1)]">{total.userName}</span>
                {total.open > 0 && <span className={BADGE.success}>{tr("en curso")}</span>}
                <span className={`ml-auto ${MUTED}`}>{tr("{n} jornada(s)", { n: total.shifts })}</span>
                <span className="w-28 text-right font-semibold text-[var(--ink-1)]">
                  {hours(total.minutes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`${CARD} overflow-hidden`}>
        {shifts.length === 0 ? (
          <p className={`p-8 text-center text-sm ${MUTED}`}>{tr("No hay jornadas en este rango.")}</p>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-[var(--surface-alt)] text-left text-xs font-semibold text-[var(--ink-2)]">
                <th className="border-b border-[var(--stroke-soft)] px-4 py-2">{tr("Día")}</th>
                {isAdmin && (
                  <th className="border-b border-[var(--stroke-soft)] px-4 py-2">{tr("Persona")}</th>
                )}
                <th className="border-b border-[var(--stroke-soft)] px-4 py-2">{tr("Entrada")}</th>
                <th className="border-b border-[var(--stroke-soft)] px-4 py-2">{tr("Salida")}</th>
                <th className="border-b border-[var(--stroke-soft)] px-4 py-2 text-right">{tr("Total")}</th>
                <th className="border-b border-[var(--stroke-soft)] px-4 py-2">{tr("Nota")}</th>
                {canAdjust && <th className="border-b border-[var(--stroke-soft)] px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr
                  key={shift.id}
                  className="hover:bg-[var(--hover)]"
                  onContextMenu={menu(() => [
                    canAdjust && { label: tr("Ajustar jornada…"), icon: Pencil, run: () => setEditing(shift) },
                    canAdjust && { label: tr("Eliminar jornada…"), icon: Trash2, danger: true, run: () => remove(shift) },
                    "separator",
                    isAdmin &&
                      selectedUser !== shift.userId && {
                        label: tr("Ver solo las horas de {userName}", { userName: shift.userName }),
                        icon: ListFilter,
                        run: () => {
                          const query = new URLSearchParams({ user: String(shift.userId) });
                          if (from) query.set("from", from);
                          if (to) query.set("to", to);
                          router.push(`/admin/hours?${query}`);
                        },
                      },
                  ])}
                >
                  <td className="border-b border-[var(--stroke-soft)] px-4 py-2 text-[var(--ink-1)]">
                    {day(shift.startedAt, loc)}
                  </td>
                  {isAdmin && (
                    <td className="border-b border-[var(--stroke-soft)] px-4 py-2">
                      {shift.userName}
                    </td>
                  )}
                  <td className="border-b border-[var(--stroke-soft)] px-4 py-2">
                    {time(shift.startedAt, loc)}
                  </td>
                  <td className="border-b border-[var(--stroke-soft)] px-4 py-2">
                    {shift.endedAt ? (
                      time(shift.endedAt, loc)
                    ) : (
                      <span className={BADGE.success}>
                        {shift.id === openShiftId ? tr("tu jornada") : tr("en curso")}
                      </span>
                    )}
                  </td>
                  <td className="border-b border-[var(--stroke-soft)] px-4 py-2 text-right font-semibold">
                    {hours(shift.minutes)}
                  </td>
                  <td className={`border-b border-[var(--stroke-soft)] px-4 py-2 ${MUTED}`}>
                    {shift.note}
                    {shift.editedAt && (
                      <span
                        className={`${BADGE.warning} ml-1`}
                        title={`${shift.editedByName}: ${shift.editReason}`}
                      >
                        
                        {tr("ajustada")}
                      </span>
                    )}
                  </td>
                  {canAdjust && (
                    <td className="border-b border-[var(--stroke-soft)] px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(shift)}
                          className="rounded-[var(--radius)] p-1.5 text-[var(--ink-2)] transition-colors hover:bg-[var(--selected)]"
                          aria-label={tr("Ajustar jornada de {userName}", { userName: shift.userName })}
                        >
                          <Pencil size={15} strokeWidth={1.75} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(shift)}
                          className="rounded-[var(--radius)] p-1.5 text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]"
                          aria-label={tr("Eliminar jornada de {userName}", { userName: shift.userName })}
                        >
                          <Trash2 size={15} strokeWidth={1.75} aria-hidden />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <form
            action={submitAdjust}
            className={`${CARD} w-full max-w-md p-4`}
            aria-label={tr("Ajustar jornada")}
          >
            <h2 className="text-sm font-semibold">{tr("Ajustar jornada")}</h2>
            <p className={`mt-1 text-sm ${MUTED}`}>
              {editing.userName} · {day(editing.startedAt, loc)}.{" "}
              {tr("El cambio queda firmado en el historial con tu nombre y el motivo.")}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label>
                <span className={LABEL}>{tr("Entrada")}</span>
                <input
                  type="datetime-local"
                  name="startedAt"
                  defaultValue={toLocalInput(editing.startedAt)}
                  className={FIELD}
                  required
                />
              </label>
              <label>
                <span className={LABEL}>{tr("Salida")}</span>
                <input
                  type="datetime-local"
                  name="endedAt"
                  defaultValue={toLocalInput(editing.endedAt)}
                  className={FIELD}
                />
              </label>
              <label className="sm:col-span-2">
                <span className={LABEL}>{tr("Nota")}</span>
                <input name="note" defaultValue={editing.note} className={FIELD} />
              </label>
              <label className="sm:col-span-2">
                <span className={LABEL}>{tr("Motivo del ajuste (obligatorio)")}</span>
                <input
                  name="reason"
                  placeholder={tr("Olvidó marcar la salida")}
                  className={FIELD}
                  required
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className={BTN}>
                
                {tr("Cancelar")}
              </button>
              <button type="submit" disabled={pending} className={BTN_PRIMARY}>
                {pending ? tr("Guardando…") : tr("Guardar ajuste")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
