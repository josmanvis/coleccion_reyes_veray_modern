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
  const router = useRouter();
  const { notify } = useToast();
  const [pending, setPending] = useState(false);
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
      await fn();
      notify(ok);
      router.refresh();
    } catch (error) {
      notify((error as Error).message, "error");
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

  const totalPlaced = usage.reduce((sum, u) => sum + u.count, 0);
  const needsTidy = usage.filter((u) => u.spellings.length > 1);

  return (
    <div className="space-y-10">
      <section className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Edificios", value: byBuilding.size },
          { label: "Lugares distintos", value: usage.length },
          { label: "Obras ubicadas", value: totalPlaced },
          { label: "Sin ubicación", value: withoutLocation },
        ].map((stat) => (
          <div key={stat.label} className="rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold leading-none text-[var(--ink-1)]">{stat.value}</p>
          </div>
        ))}
      </section>

      {needsTidy.length > 0 && (
        <section>
          <h2 className="border-b border-[var(--stroke-soft)] pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
            Grafías por unificar · {needsTidy.length}
          </h2>
          <p className="mt-2 max-w-[75ch] text-sm text-[var(--ink-3)]">
            El mismo lugar está escrito de varias formas. Unificar reescribe la columna
            «Localización» de esas obras a una sola grafía; no mueve nada físicamente.
          </p>
          <ul className="mt-3 space-y-2">
            {needsTidy.map((place) => (
              <li
                key={place.key}
                className="flex flex-wrap items-center gap-3 rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-2.5"
              >
                <span className="font-medium text-[var(--ink-1)]">{place.canonical}</span>
                <span className="text-xs text-[var(--ink-3)]">{place.count} obras</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--ink-3)]">
                  {place.spellings.map((s) => `"${s.raw}"`).join("  ")}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setConfirm({
                      title: `¿Unificar a «${place.canonical}»?`,
                      body: `${place.spellings.length} grafías distintas pasarán a escribirse igual en ${place.count} obras.`,
                      run: () =>
                        run(() => post({ action: "normalize", key: place.key }), "Grafías unificadas"),
                    })
                  }
                  className={`${BTN} shrink-0 border-[var(--stroke)] text-[var(--ink-1)] hover:bg-[var(--hover)] focus-visible:outline-[var(--brand)]`}
                >
                  Unificar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="border-b border-[var(--stroke-soft)] pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
          Dónde está la colección
        </h2>
        <div className="mt-3 space-y-6">
          {[...byBuilding.entries()].map(([code, places]) => (
            <div key={code} className="rounded border border-[var(--stroke-soft)] bg-[var(--surface)]">
              <header className="flex flex-wrap items-baseline gap-3 border-b border-[var(--stroke-soft)] px-4 py-2.5">
                <h3 className="text-lg text-[var(--ink-1)]">
                  {code === "—" ? "Sin edificio" : `Edificio ${code}`}
                </h3>
                <span className="text-xs text-[var(--ink-3)]">
                  {places.length} lugares · {places.reduce((s, p) => s + p.count, 0)} obras
                </span>
              </header>
              <ul className="divide-y divide-[var(--stroke-soft)]">
                {places.map((place) => (
                  <li key={place.key} className="flex flex-wrap items-center gap-3 px-4 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink-1)]">
                      {place.kind ? (
                        <span className="mr-2 rounded bg-[var(--hover)] px-1.5 py-0.5 text-xs font-medium text-[var(--ink-2)]">
                          {UNIT_LABELS[place.kind]}
                        </span>
                      ) : null}
                      {place.canonical || place.spellings[0]?.raw}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-[var(--ink-3)]">
                      {place.count} obras
                    </span>
                    <Link
                      href={`/inventory?location=${encodeURIComponent(place.spellings[0].raw)}`}
                      className="shrink-0 text-xs font-medium text-[var(--ink-2)] underline-offset-2 hover:underline"
                    >
                      Ver
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
            Sin edificio reconocido
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-3)]">
            Estas obras registran un lugar que no es 480 ni 482 — casas de familia, préstamos y
            similares. Se dejan como están.
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
          Registro de edificios y unidades
        </h2>
        <p className="mt-2 max-w-[75ch] text-sm text-[var(--ink-3)]">
          Da de alta gavetas, cajas, palomares o archivos por adelantado — en cualquier edificio —
          para poder asignarlos aunque todavía no haya obras dentro.
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-medium text-[var(--ink-3)]">Edificios</h3>
            <ul className="mb-3 space-y-1.5">
              {buildings.map((building) => (
                <li
                  key={building.id}
                  className="flex items-center gap-3 rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-3 py-2 text-sm"
                >
                  <span className="font-medium text-[var(--ink-1)]">{building.code}</span>
                  <span className="min-w-0 flex-1 truncate text-[var(--ink-3)]">
                    {building.name ?? "—"}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      setConfirm({
                        title: `¿Eliminar el edificio ${building.code}?`,
                        body: "Se borran también sus unidades registradas. No cambia la columna «Localización» de ninguna obra.",
                        run: () =>
                          run(
                            () => post({ action: "delete_building", id: building.id }),
                            "Edificio eliminado"
                          ),
                      })
                    }
                    className="shrink-0 text-xs text-red-700 hover:underline"
                  >
                    Eliminar
                  </button>
                </li>
              ))}
              {buildings.length === 0 && (
                <li className="text-sm text-[var(--ink-3)]">Todavía no hay edificios registrados.</li>
              )}
            </ul>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () => post({ action: "create_building", ...newBuilding }),
                  `Edificio ${newBuilding.code} añadido`
                ).then(() => setNewBuilding({ code: "", name: "" }));
              }}
            >
              <input
                value={newBuilding.code}
                onChange={(e) => setNewBuilding({ ...newBuilding, code: e.target.value })}
                placeholder="Código (480)"
                className={`${FIELD} w-32`}
              />
              <input
                value={newBuilding.name}
                onChange={(e) => setNewBuilding({ ...newBuilding, name: e.target.value })}
                placeholder="Nombre (opcional)"
                className={`${FIELD} flex-1`}
              />
              <button
                type="submit"
                disabled={!newBuilding.code.trim() || pending}
                className={`${BTN} border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] focus-visible:outline-[var(--brand)]`}
              >
                Añadir
              </button>
            </form>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium text-[var(--ink-3)]">
              Unidades registradas ({units.length})
            </h3>
            <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {units.map((unit) => (
                <li
                  key={unit.id}
                  className="flex items-center gap-3 rounded border border-[var(--stroke-soft)] bg-[var(--surface)] px-3 py-2 text-sm"
                >
                  <span className="text-[var(--ink-1)]">
                    {unit.building} · {UNIT_LABELS[unit.kind]} {unit.label}
                    {unit.room ? ` · Sala ${unit.room}` : ""}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => post({ action: "delete_unit", id: unit.id }), "Unidad eliminada")
                    }
                    className="ml-auto shrink-0 text-xs text-red-700 hover:underline"
                  >
                    Quitar
                  </button>
                </li>
              ))}
              {units.length === 0 && (
                <li className="text-sm text-[var(--ink-3)]">Ninguna unidad dada de alta todavía.</li>
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
                  "Unidad añadida"
                ).then(() => setNewUnit({ ...newUnit, label: "", room: "" }));
              }}
            >
              <select
                value={newUnit.building_id}
                onChange={(e) => setNewUnit({ ...newUnit, building_id: e.target.value })}
                className={`${FIELD} w-28`}
              >
                <option value="">Edificio</option>
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
                    {UNIT_LABELS[k]}
                  </option>
                ))}
              </select>
              <input
                value={newUnit.label}
                onChange={(e) => setNewUnit({ ...newUnit, label: e.target.value })}
                placeholder="Número"
                className={`${FIELD} w-24`}
              />
              <input
                value={newUnit.room}
                onChange={(e) => setNewUnit({ ...newUnit, room: e.target.value })}
                placeholder="Sala"
                className={`${FIELD} w-20`}
              />
              <button
                type="submit"
                disabled={!newUnit.building_id || !newUnit.label.trim() || pending}
                className={`${BTN} border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] focus-visible:outline-[var(--brand)]`}
              >
                Añadir
              </button>
            </form>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ""}
        body={confirm?.body}
        confirmLabel="Confirmar"
        pending={pending}
        onConfirm={() => confirm?.run()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
