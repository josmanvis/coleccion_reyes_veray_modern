import { NextResponse } from "next/server";
import { createArtwork, facets, listArtworks } from "@/lib/inventory/db";
import { parseListParams } from "@/lib/inventory/params";
import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = listArtworks(parseListParams(searchParams));
  return NextResponse.json(
    searchParams.get("facets") === "1" ? { ...result, facets: facets() } : result
  );
}

export async function POST(request: Request) {
  try {
    const values = await request.json();
    const created = createArtwork(values);
    if (!created) return NextResponse.json({ error: "No se pudo crear" }, { status: 400 });
    record({
      actor: await currentActor(),
      action: "crear",
      entity: "obra",
      entityId: String(created.ref),
      summary: `Alta de la obra ${created.registro}${created.title ? ` · ${created.title}` : ""}`,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
