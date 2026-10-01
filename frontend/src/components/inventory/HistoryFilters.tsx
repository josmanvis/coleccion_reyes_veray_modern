"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { BTN, BTN_PRIMARY, CARD, FIELD, LABEL } from "./ui";
import { useTr } from "@/components/I18nProvider";

/**
 * Filters kept in the URL rather than in component state, so a particular view
 * of the history — one person, one day — can be linked to or reloaded.
 */
export default function HistoryFilters({
  facets,
  canFilterUser,
}: {
  facets: {
    users: Array<{ id: number | null; name: string; n: number }>;
    entities: string[];
    actions: string[];
  };
  canFilterUser: boolean;
}) {
  const tr = useTr();
  const router = useRouter();
  const params = useSearchParams();
  const value = (key: string) => params?.get(key) ?? "";
  const active = ["user", "entity", "action", "q", "from", "to"].some((key) => value(key));

  function apply(form: FormData) {
    const next = new URLSearchParams();
    for (const [key, raw] of form.entries()) {
      const text = String(raw).trim();
      if (text) next.set(key, text);
    }
    router.push(`/admin/history${next.size > 0 ? `?${next}` : ""}`);
  }

  return (
    <form action={apply} className={`${CARD} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6`}>
      <label className="lg:col-span-2">
        <span className={LABEL}>{tr("Buscar")}</span>
        <input
          name="q"
          defaultValue={value("q")}
          placeholder={tr("Obra, persona, resumen…")}
          className={FIELD}
        />
      </label>

      {canFilterUser && (
        <label>
          <span className={LABEL}>{tr("Quién")}</span>
          <select name="user" defaultValue={value("user")} className={FIELD}>
            <option value="">{tr("Todos")}</option>
            {facets.users.map((user) => (
              <option key={`${user.id}-${user.name}`} value={user.id ?? ""}>
                {tr(user.name)} ({user.n})
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        <span className={LABEL}>{tr("Qué")}</span>
        <select name="entity" defaultValue={value("entity")} className={FIELD}>
          <option value="">{tr("Todo")}</option>
          {facets.entities.map((entity) => (
            <option key={entity} value={entity}>
              {entity}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className={LABEL}>{tr("Acción")}</span>
        <select name="action" defaultValue={value("action")} className={FIELD}>
          <option value="">{tr("Todas")}</option>
          {facets.actions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className={LABEL}>{tr("Desde")}</span>
        <input type="date" name="from" defaultValue={value("from")} className={FIELD} />
      </label>

      <label>
        <span className={LABEL}>{tr("Hasta")}</span>
        <input type="date" name="to" defaultValue={value("to")} className={FIELD} />
      </label>

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
        <button type="submit" className={BTN_PRIMARY}>
          <Search size={15} strokeWidth={1.75} aria-hidden />
          
          {tr("Filtrar")}
        </button>
        {active && (
          <button type="button" onClick={() => router.push("/admin/history")} className={BTN}>
            <X size={15} strokeWidth={1.75} aria-hidden />
            
            {tr("Limpiar")}
          </button>
        )}
      </div>
    </form>
  );
}
