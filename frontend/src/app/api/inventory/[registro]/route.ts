import { NextResponse } from "next/server";
import { deleteArtwork, getArtwork, updateArtwork } from "@/lib/inventory/db";
import { diffRows, record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ registro: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { registro } = await params;
  const artwork = getArtwork(registro);
  if (!artwork) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(artwork);
}

export async function PATCH(request: Request, { params }: Context) {
  const { registro } = await params;
  try {
    const patch = await request.json();
    const before = getArtwork(registro);
    const updated = updateArtwork(registro, patch);
    if (!updated) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const changes = diffRows(before, updated);
    if (changes.length > 0) {
      record({
        actor: await currentActor(),
        action: "editar",
        entity: "obra",
        entityId: String(updated.ref),
        summary: `${updated.registro} · ${changes.length} campo(s)`,
        changes,
      });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { registro } = await params;
  const before = getArtwork(registro);
  const actor = await currentActor();
  const trashId = deleteArtwork(registro, actor);
  if (!trashId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  record({
    actor,
    action: "eliminar",
    entity: "obra",
    entityId: registro,
    summary: `Baja de la obra ${before?.registro ?? registro}${before?.title ? ` · ${before.title}` : ""}`,
    // The whole record, because after a delete there is nothing left to compare.
    changes: before
      ? Object.entries(before)
          .filter(([, value]) => value !== null && value !== "")
          .map(([field, value]) => ({ field, before: String(value), after: "" }))
      : [],
  });
  return NextResponse.json({ ok: true, trashId });
}
