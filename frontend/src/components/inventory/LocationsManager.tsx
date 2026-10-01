"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  UNIT_KINDS,
  UNIT_LABELS,
  type Building,
  type StorageUnit,
  type UnitKind,
  type UnitUsage,
} from "@/lib/inventory/location-types";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./ToastProvider";
import { useTr } from "@/components/I18nProvider";
import { Copy, Merge, Search, Trash2 } from "lucide-react";
import { copyText, useContextMenu, type MenuEntry } from "./ContextMenu";
import { newWindowItem } from "./context-menus";
import { useDeletedToast } from "./trash-client";

const FIELD =
  "rounded border border-[var(--stroke)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--ink-1)] outline-none transition placeholder:text-[var(--ink-4)] focus:border-[var(--brand)]";
const BTN =
  "rounded border px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40";

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo guardar");
  return data;
}

export default function LocationsManager({
  buildings,
  units,
  usage,
  unparsed,
  withoutLocation,
}: {
  buildings: Building[];
  units: StorageUnit[];
  usage: UnitUsage[];
  unparsed: UnitUsage[];
  withoutLocation: number;
}) {
  const tr = useTr();
  const router = useRouter();
  const { notify } = useToast();
  const [pending, setPending] = useState(false);
  const menu = useContextMenu();
  const deletedToast = useDeletedToast();
  const [confirm, setConfirm] = useState<null | { title: string; body: string; run: () => Promise<void> }>(
    null
  );

  const [newBuilding, setNewBuilding] = useState({ code: "", name: "" });
  const [newUnit, setNewUnit] = useState<{ building_id: string; kind: UnitKind; label: string; room: string }>(
    { building_id: "", kind: "gaveta", label: "", room: "" }
  );

  async function run(fn: () => Promise<unknown>, ok: string) {
    setPending(true);
    try {
      const result = (await fn()) as { trashId?: number } | undefined;
      if (result?.trashId) deletedToast(ok, result.trashId);
      else notify(ok);
      router.refresh();
    } catch (error) {
      notify(tr((error as Error).message), "error");
    }
    setPending(false);
    setConfirm(null);
  }

  /** Works grouped under each building, from what the records actually say. */
  const byBuilding = new Map<string, UnitUsage[]>();
  for (const place of usage) {
    const key = place.building ?? "—";
    if (!byBuilding.has(key)) byBuilding.set(key, []);
    byBuilding.get(key)!.push(place);
  }

  /** What every place row offers: its works, and its name. */
  function placeMenu(place: UnitUsage): MenuEntry[] {
    const label = place.canonical || place.spellings[0]?.raw || "";
    const href = `/inventory?location=${encodeURIComponent(place.spellings[0]?.raw ?? "")}`;
    return [
      { label: tr("Ver obras aquí"), icon: Search, run: () => router.push(href) },
      newWindowItem(href, tr),
      "separator",
      { label: tr("Copiar nombre"), icon: Copy, run: () => copyText(label) },
    ];
  }

  function askNormalize(place: UnitUsage) {
    setConfirm({
      title: tr("¿Unificar a «{canonical}»?", { canonical: place.canonical }),
      body: tr("{length} grafías distintas pasarán a escribirse igual en {count} obras.", { length: place.spellings.length, count: place.count }),
      run: () => run(() => post({ action: "normalize", key: place.key }), tr("Grafías unificadas")),
    });
  }

  function askDeleteBuilding(building: Building) {
    setConfirm({
      title: tr("¿Eliminar el edificio {code}?", { code: building.code }),
      body: tr("Va a la papelera junto con sus unidades registradas, y se puede restaurar. No cambia la columna «Localización» de ninguna obra."),
      run: () => run(() => post({ action: "delete_building", id: building.id }), tr("Edificio enviado a la papelera")),
    });
  }

  const totalPlaced = usage.reduce((sum, u) => sum + u.count, 0);
  const needsTidy = usage.filter((u) => u.spellings.length > 1);

  return (
    <div className="space-y-10">
      <section className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Edificios", value: byBuilding.size },
          { label: "Lugares distintos", value: usage.length },
          { label: tr("Obras ubicadas"), value: totalPlaced },
          { label: tr("Sin ubicación"), value: withoutLocation },
        ].map((stat) => (
          <div key={stat.label} className="rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">{tr(stat.label)}</p>
            <p className="mt-1 text-lg font-semibold leading-none text-[var(--ink-1)]">{stat.value}</p>
          </div>
        ))}
      </section>

      {needsTidy.length > 0 && (
        <section>
          <h2 className="border-b border-[var(--stroke-soft)] pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
            {tr("Grafías por unificar · {n}", { n: needsTidy.length })}
          </h2>
          <p className="mt-2 max-w-[75ch] text-sm text-[var(--ink-3)]">
            
            {tr("El mismo lugar está escrito de varias formas. Unificar reescribe la columna «Localización» de esas obras a una sola grafía; no mueve nada físicamente.")}
          </p>
          <ul className="mt-3 space-y-2">
            {needsTidy.map((place) => (
              <li
                key={place.key}
                className="flex flex-wrap items-center gap-3 rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-2.5"
                onContextMenu={menu(() => [
                  { label: tr("Unificar…"), icon: Merge, disabled: pending, run: () => askNormalize(place) },
                  "separator",
                  ...placeMenu(place),
                ])}
              >
                <span className="font-medium text-[var(--ink-1)]">{place.canonical}</span>
                <span className="text-xs text-[var(--ink-3)]">{tr("{n} obras", { n: place.count })}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--ink-3)]">
                  {place.spellings.map((s) => `"${s.raw}"`).join("  ")}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => askNormalize(place)}
                  className={`${BTN} shrink-0 border-[var(--stroke)] text-[var(--ink-1)] hover:bg-[var(--hover)] focus-visible:outline-[var(--brand)]`}
                >
                  
                  {tr("Unificar")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="border-b border-[var(--stroke-soft)] pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
          
          {tr("Dónde está la colección")}
        </h2>
        <div className="mt-3 space-y-6">
          {[...byBuilding.entries()].map(([code, places]) => (
            <div key={code} className="rounded border border-[var(--stroke-soft)] bg-[var(--surface)]">
              <header className="flex flex-wrap items-baseline gap-3 border-b border-[var(--stroke-soft)] px-4 py-2.5">
                <h3 className="text-lg text-[var(--ink-1)]">
                  {code === "—" ? tr("Sin edificio") : tr("Edificio {code}", { code })}
                </h3>
                <span className="text-xs text-[var(--ink-3)]">
                  {tr("{n} lugares · {m} obras", { n: places.length, m: places.reduce((s, p) => s + p.count, 0) })}
                </span>
              </header>
              <ul className="divide-y divide-[var(--stroke-soft)]">
                {places.map((place) => (
                  <li
                    key={place.key}
                    className="flex flex-wrap items-center gap-3 px-4 py-2"
                    onContextMenu={menu(() => placeMenu(place))}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink-1)]">
                      {place.kind ? (
                        <span className="mr-2 rounded bg-[var(--hover)] px-1.5 py-0.5 text-xs font-medium text-[var(--ink-2)]">
                          {tr(UNIT_LABELS[place.kind])}
                        </span>
                      ) : null}
                      {place.canonical || place.spellings[0]?.raw}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-[var(--ink-3)]">
                      {tr("{n} obras", { n: place.count })}
                    </span>
                    <Link
                      href={`/inventory?location=${encodeURIComponent(place.spellings[0].raw)}`}
                      className="shrink-0 text-xs font-medium text-[var(--ink-2)] underline-offset-2 hover:underline"
                    >
                      
                      {tr("Ver")}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {unparsed.length > 0 && (
        <section>
          <h2 className="border-b border-[var(--stroke-soft)] pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
            
            {tr("Sin edificio reconocido")}
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-3)]">
            
            {tr("Estas obras registran un lugar que no es 480 ni 482 — casas de familia, préstamos y similares. Se dejan como están.")}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {unparsed.flatMap((g) => g.spellings).map((s) => (
              <li
                key={s.raw}
                className="rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--ink-2)]"
              >
                {s.raw} <span className="text-[var(--ink-3)]">· {s.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="border-b border-[var(--stroke-soft)] pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
          
          {tr("Registro de edificios y unidades")}
        </h2>
        <p className="mt-2 max-w-[75ch] text-sm text-[var(--ink-3)]">
          
          {tr("Da de alta gavetas, cajas, palomares o archivos por adelantado — en cualquier edificio — para poder asignarlos aunque todavía no haya obras dentro.")}
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-medium text-[var(--ink-3)]">{tr("Edificios")}</h3>
            <ul className="mb-3 space-y-1.5">
              {buildings.map((building) => (
                <li
                  key={building.id}
                  className="flex items-center gap-3 rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-3 py-2 text-sm"
                  onContextMenu={menu(() => [
                    { label: tr("Copiar código"), icon: Copy, run: () => copyText(building.code) },
                    "separator",
                    {
                      label: tr("Eliminar edificio…"),
                      icon: Trash2,
                      danger: true,
                      disabled: pending,
                      run: () => askDeleteBuilding(building),
                    },
                  ])}
                >
                  <span className="font-medium text-[var(--ink-1)]">{building.code}</span>
                  <span className="min-w-0 flex-1 truncate text-[var(--ink-3)]">
                    {building.name ?? "—"}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => askDeleteBuilding(building)}
                    className="shrink-0 text-xs text-red-700 hover:underline"
                  >
                    
                    {tr("Eliminar")}
                  </button>
                </li>
              ))}
              {buildings.length === 0 && (
                <li className="text-sm text-[var(--ink-3)]">{tr("Todavía no hay edificios registrados.")}</li>
              )}
            </ul>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () => post({ action: "create_building", ...newBuilding }),
                  tr("Edificio {code} añadido", { code: newBuilding.code })
                ).then(() => setNewBuilding({ code: "", name: "" }));
              }}
            >
              <input
                value={newBuilding.code}
                onChange={(e) => setNewBuilding({ ...newBuilding, code: e.target.value })}
                placeholder={tr("Código (480)")}
                className={`${FIELD} w-32`}
              />
              <input
                value={newBuilding.name}
                onChange={(e) => setNewBuilding({ ...newBuilding, name: e.target.value })}
                placeholder={tr("Nombre (opcional)")}
                className={`${FIELD} flex-1`}
              />
              <button
                type="submit"
                disabled={!newBuilding.code.trim() || pending}
                className={`${BTN} border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] focus-visible:outline-[var(--brand)]`}
              >
                
                {tr("Añadir")}
              </button>
            </form>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium text-[var(--ink-3)]">
              {tr("Unidades registradas ({n})", { n: units.length })}
            </h3>
            <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {units.map((unit) => (
                <li
                  key={unit.id}
                  className="flex items-center gap-3 rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-3 py-2 text-sm"
                  onContextMenu={menu(() => [
                    {
                      label: tr("Quitar unidad"),
                      icon: Trash2,
                      danger: true,
                      disabled: pending,
                      run: () => run(() => post({ action: "delete_unit", id: unit.id }), tr("Unidad enviada a la papelera")),
                    },
                  ])}
                >
                  <span className="text-[var(--ink-1)]">
                    {unit.building} · {tr(UNIT_LABELS[unit.kind])} {unit.label}
                    {unit.room ? ` · ${tr("Sala {room}", { room: unit.room })}` : ""}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => post({ action: "delete_unit", id: unit.id }), tr("Unidad enviada a la papelera"))
                    }
                    className="ml-auto shrink-0 text-xs text-red-700 hover:underline"
                  >
                    
                    {tr("Quitar")}
                  </button>
                </li>
              ))}
              {units.length === 0 && (
                <li className="text-sm text-[var(--ink-3)]">{tr("Ninguna unidad dada de alta todavía.")}</li>
              )}
            </ul>

            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    post({
                      action: "create_unit",
                      building_id: Number(newUnit.building_id),
                      kind: newUnit.kind,
                      label: newUnit.label,
                      room: newUnit.room,
                    }),
                  tr("Unidad añadida")
                ).then(() => setNewUnit({ ...newUnit, label: "", room: "" }));
              }}
            >
              <select
                value={newUnit.building_id}
                onChange={(e) => setNewUnit({ ...newUnit, building_id: e.target.value })}
                className={`${FIELD} w-28`}
              >
                <option value="">{tr("Edificio")}</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code}
                  </option>
                ))}
              </select>
              <select
                value={newUnit.kind}
                onChange={(e) => setNewUnit({ ...newUnit, kind: e.target.value as UnitKind })}
                className={`${FIELD} w-32`}
              >
                {UNIT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {tr(UNIT_LABELS[k])}
                  </option>
                ))}
              </select>
              <input
                value={newUnit.label}
                onChange={(e) => setNewUnit({ ...newUnit, label: e.target.value })}
                placeholder={tr("Número")}
                className={`${FIELD} w-24`}
              />
              <input
                value={newUnit.room}
                onChange={(e) => setNewUnit({ ...newUnit, room: e.target.value })}
                placeholder={tr("Sala")}
                className={`${FIELD} w-20`}
              />
              <button
                type="submit"
                disabled={!newUnit.building_id || !newUnit.label.trim() || pending}
                className={`${BTN} border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] focus-visible:outline-[var(--brand)]`}
              >
                
                {tr("Añadir")}
              </button>
            </form>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ""}
        body={confirm?.body}
        confirmLabel={tr("Confirmar")}
        pending={pending}
        onConfirm={() => confirm?.run()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
