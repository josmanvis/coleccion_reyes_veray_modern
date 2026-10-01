import Link from "next/link";
import { listBuildings, listUnits, locationUsage } from "@/lib/inventory/locations";
import LocationsManager from "@/components/inventory/LocationsManager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ubicaciones · Inventario" };

export default async function LocationsPage() {
  const { units: usage, unparsed, withoutLocation } = locationUsage();

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <h1 className="text-3xl leading-none">Ubicaciones</h1>
          <p className="mt-1.5 max-w-[75ch] text-sm text-[var(--ink-3)]">
            Dónde se guarda físicamente cada obra. La columna «Localización» de la hoja de cálculo
            sigue mandando; aquí se lee en estructura — edificio, sala y unidad — para poder
            revisarla, unificar grafías y dar de alta unidades nuevas.
          </p>
        </div>
        <Link
          href="/inventory"
          className="rounded border border-[var(--stroke)] px-3 py-2 text-sm font-medium text-[var(--ink-2)] transition hover:bg-[var(--hover)]"
        >
          Ir al inventario
        </Link>
      </div>

      <LocationsManager
        buildings={listBuildings()}
        units={listUnits()}
        usage={usage}
        unparsed={unparsed}
        withoutLocation={withoutLocation}
      />
    </main>
  );
}
