import Link from "next/link";
import { mapData } from "@/lib/inventory/location-map";
import LocationMap from "@/components/inventory/LocationMap";
import { getTr } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const tr = await getTr();
  return { title: tr("Plano de ubicaciones · Inventario") };
}

export default async function LocationMapPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; room?: string; floor?: string }>;
}) {
  const tr = await getTr();
  const { q, room, floor } = await searchParams;
  const { places, works } = mapData();

  return (
    <main className="mx-auto max-w-[1600px] px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
        <div>
          <h1 className="text-3xl leading-none">{tr("Plano de ubicaciones")}</h1>
          <p className="mt-1 max-w-[75ch] text-sm text-[var(--ink-3)]">
            {tr("480 y 482 Calle José A. Canals. Las salas llevan el número de la columna «Localización» («480-13» es Conferencia).")}
          </p>
        </div>
        <Link
          href="/admin/locations"
          className="rounded border border-[var(--stroke)] px-3 py-2 text-sm font-medium text-[var(--ink-2)] transition hover:bg-[var(--hover)]"
        >
          {tr("Volver a ubicaciones")}
        </Link>
      </div>

      <LocationMap places={places} works={works} initialQuery={q ?? ""} initialRoom={room ?? null} initialFloor={floor ?? null} />
    </main>
  );
}
