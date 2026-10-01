import Link from "next/link";
import { MapPin } from "lucide-react";
import { FLOORS } from "@/lib/inventory/floorplan";
import type { ArtworkPlacement } from "@/lib/inventory/location-map";
import { getTr } from "@/lib/i18n-server";
import { MUTED } from "./ui";
import ArtworkPlanView from "./ArtworkPlanView";

/**
 * Where the work is stored, drawn on the floor plan. When the place has no
 * room yet the building's plan is still shown, and a room can be picked on it
 * — the same assignment the full plan at /admin/locations/map makes.
 */
export default async function ArtworkLocationMap({
  placement,
  registro,
}: {
  placement: ArtworkPlacement | null;
  registro: string;
}) {
  const tr = await getTr();
  const mapHref = `/admin/locations/map?q=${encodeURIComponent(registro)}${
    placement?.roomId ? `&room=${encodeURIComponent(placement.roomId)}` : ""
  }`;

  // The building's floors; every floor when the cell names a drawer but no building.
  const floors = placement
    ? placement.building
      ? FLOORS.filter((floor) => floor.building === placement.building)
      : placement.offsite
        ? []
        : FLOORS
    : [];

  return (
    <section className="mt-6 rounded border border-[var(--stroke-soft)] bg-[var(--surface)] p-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
        <MapPin size={14} strokeWidth={1.75} aria-hidden />
        {tr("Ubicación")}
        <Link href={mapHref} className="ml-auto text-[11px] normal-case tracking-normal text-[var(--brand)] hover:underline">
          {tr("Ver plano completo →")}
        </Link>
      </h2>

      {!placement ? (
        <p className={`mt-3 text-sm ${MUTED}`}>{tr("Sin localización registrada.")}</p>
      ) : floors.length === 0 ? (
        <>
          <p className="mt-3 text-sm text-[var(--ink-1)]">{placement.raw}</p>
          <p className={`mt-1 text-xs ${MUTED}`}>{tr("Fuera de los edificios del plano.")}</p>
        </>
      ) : (
        <ArtworkPlanView
          floorIds={floors.map((floor) => floor.id)}
          placeKey={placement.key}
          raw={placement.raw}
          roomId={placement.roomId}
          source={placement.source}
        />
      )}
    </section>
  );
}
