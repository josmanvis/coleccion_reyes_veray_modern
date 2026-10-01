import { NextResponse } from "next/server";
import {
  createBuilding,
  createUnit,
  deleteBuilding,
  deleteUnit,
  listBuildings,
  listUnits,
  locationUsage,
  normalizeSpellings,
  updateBuilding,
  updateUnit,
} from "@/lib/inventory/locations";

import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    buildings: listBuildings(),
    units: listUnits(),
    usage: locationUsage(),
  });
}

/**
 * One endpoint for the whole registry; `action` says which part is being
 * changed, so the admin screen does not need five separate routes.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const who = await currentActor();

    /** Every branch below writes to the registry, so each one is logged. */
    const log = (summary: string, entityId?: string) =>
      record({
        actor: who,
        action: String(body.action).replace(/_/g, " "),
        entity: "localización",
        entityId: entityId ?? null,
        summary,
      });

    switch (body.action) {
      case "create_building": {
        const building = createBuilding(body.code, body.name);
        log(`Nuevo edificio ${body.code} · ${body.name}`, String(body.code ?? ""));
        return NextResponse.json(building, { status: 201 });
      }
      case "update_building":
        updateBuilding(Number(body.id), body);
        log(`Edificio ${body.code ?? body.id} actualizado`, String(body.id));
        return NextResponse.json({ ok: true });
      case "delete_building": {
        const ok = deleteBuilding(Number(body.id));
        if (ok) log(`Edificio ${body.id} eliminado`, String(body.id));
        return NextResponse.json({ ok });
      }
      case "create_unit": {
        const unit = createUnit(body);
        log(`Nueva unidad ${body.name ?? body.code ?? ""}`, String(body.code ?? ""));
        return NextResponse.json(unit, { status: 201 });
      }
      case "update_unit":
        updateUnit(Number(body.id), body);
        log(`Unidad ${body.name ?? body.id} actualizada`, String(body.id));
        return NextResponse.json({ ok: true });
      case "delete_unit": {
        const ok = deleteUnit(Number(body.id));
        if (ok) log(`Unidad ${body.id} eliminada`, String(body.id));
        return NextResponse.json({ ok });
      }
      case "normalize": {
        const updated = normalizeSpellings(String(body.key));
        log(`Grafías unificadas en ${updated} obra(s) · ${body.key}`, String(body.key));
        return NextResponse.json({ updated });
      }
      default:
        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
