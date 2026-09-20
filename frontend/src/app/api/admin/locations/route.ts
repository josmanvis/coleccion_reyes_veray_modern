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
    switch (body.action) {
      case "create_building":
        return NextResponse.json(createBuilding(body.code, body.name), { status: 201 });
      case "update_building":
        updateBuilding(Number(body.id), body);
        return NextResponse.json({ ok: true });
      case "delete_building":
        return NextResponse.json({ ok: deleteBuilding(Number(body.id)) });
      case "create_unit":
        return NextResponse.json(createUnit(body), { status: 201 });
      case "update_unit":
        updateUnit(Number(body.id), body);
        return NextResponse.json({ ok: true });
      case "delete_unit":
        return NextResponse.json({ ok: deleteUnit(Number(body.id)) });
      case "normalize":
        return NextResponse.json({ updated: normalizeSpellings(String(body.key)) });
      default:
        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
