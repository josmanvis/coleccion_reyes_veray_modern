"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Monitor, Wifi } from "lucide-react";
import { BADGE, BTN, CARD, MUTED } from "./ui";
import { initialsOf, bubbleColor } from "@/lib/inventory/theme";

type Change = { field: string; label?: string; before: string; after: string };

type Entry = {
  id: number;
  at: string;
  user_id: number | null;
  user_name: string;
  role: string;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
  origin: string;
  hash: string;
  changes: Change[];
};

/** Times are stored UTC; the reader wants their own clock. */
function when(at: string): string {
  // SQLite's datetime() has no zone marker, but is UTC.
  const parsed = new Date(at.includes("T") ? at : `${at.replace(" ", "T")}Z`);
  return parsed.toLocaleString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Where an entry points, when it points at something you can open. */
function linkFor(entry: Entry): string | null {
  if (entry.entity === "obra" && entry.entity_id) return `/inventory/${entry.entity_id}`;
  if (entry.entity === "usuario") return "/admin/users";
  if (entry.entity === "jornada") return "/admin/hours";
  return null;
}

export default function HistoryList({
  entries,
  total,
  page,
  perPage,
}: {
  entries: Entry[];
  total: number;
  page: number;
  perPage: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [expanded, setExpanded] = useState<number | null>(null);

  function goToPage(next: number) {
    const query = new URLSearchParams(params?.toString() ?? "");
    if (next <= 1) query.delete("page");
    else query.set("page", String(next));
    router.push(`/admin/history${query.size > 0 ? `?${query}` : ""}`);
  }

  if (entries.length === 0) {
    return (
      <div className={`${CARD} p-8 text-center`}>
        <p className={`text-sm ${MUTED}`}>No hay movimientos que coincidan.</p>
      </div>
    );
  }

  const pages = Math.ceil(total / perPage);

  return (
    <div className={`${CARD} overflow-hidden`}>
      <ul className="divide-y divide-[var(--stroke-soft)]">
        {entries.map((entry) => {
          const open = expanded === entry.id;
          const href = linkFor(entry);
          return (
            <li key={entry.id}>
              <div className="flex items-start gap-3 px-4 py-2.5">
                <span
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
                  style={{ background: bubbleColor(entry.user_name) }}
                  aria-hidden
                >
                  {initialsOf(entry.user_name)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--ink-1)]">
                    <span className="font-medium">{entry.user_name}</span>
                    <span className={BADGE.neutral}>{entry.action}</span>
                    <span className={MUTED}>{entry.entity}</span>
                  </p>
                  <p className="mt-0.5 break-words text-sm text-[var(--ink-2)]">
                    {href ? (
                      <Link href={href} className="hover:underline">
                        {entry.summary}
                      </Link>
                    ) : (
                      entry.summary
                    )}
                  </p>
                  <p className={`mt-0.5 flex items-center gap-1.5 text-xs ${MUTED}`}>
                    {entry.origin.includes("red") ? (
                      <Wifi size={12} strokeWidth={1.75} aria-hidden />
                    ) : (
                      <Monitor size={12} strokeWidth={1.75} aria-hidden />
                    )}
                    {when(entry.at)}
                    {entry.origin && ` · ${entry.origin}`}
                  </p>
                </div>

                {entry.changes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : entry.id)}
                    aria-expanded={open}
                    className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-[var(--radius)] px-2 py-1 text-xs font-semibold text-[var(--ink-2)] transition-colors hover:bg-[var(--hover)]"
                  >
                    {open ? (
                      <ChevronDown size={14} strokeWidth={2} aria-hidden />
                    ) : (
                      <ChevronRight size={14} strokeWidth={2} aria-hidden />
                    )}
                    {entry.changes.length}
                  </button>
                )}
              </div>

              {open && (
                <div className="border-t border-[var(--stroke-soft)] bg-[var(--surface-alt)] px-4 py-3">
                  <table className="w-full text-sm">
                    <tbody className="align-top">
                      {entry.changes.map((change, index) => (
                        <tr key={`${change.field}-${index}`}>
                          <th
                            scope="row"
                            className="w-40 py-1 pr-3 text-left text-xs font-semibold text-[var(--ink-2)]"
                          >
                            {change.label || change.field}
                          </th>
                          <td className="py-1 pr-3 text-[var(--ink-3)] line-through">
                            {change.before || "—"}
                          </td>
                          <td className="py-1 text-[var(--ink-1)]">{change.after || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className={`mt-2 break-all font-mono text-[10px] ${MUTED}`}>
                    firma {entry.hash.slice(0, 32)}…
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {pages > 1 && (
        <div className="flex items-center gap-2 border-t border-[var(--stroke-soft)] px-4 py-2.5">
          <span className={`text-sm ${MUTED}`}>
            {total} movimiento(s) · página {page} de {pages}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className={BTN}
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= pages}
              className={BTN}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
