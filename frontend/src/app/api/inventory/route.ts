import {isSameOrigin} from "@/lib/site-config";
import { NextResponse } from "next/server";
import { createArtwork, facets, getArtwork, getDb, listArtworks, updateArtwork, type ArtworkRow } from "@/lib/inventory/db";
import { parseListParams } from "@/lib/inventory/params";
import { diffRows, record } from "@/lib/inventory/audit";
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
  if(!isSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
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

/**
 * Saves many records at once, for the sheet view: `{ updates: [{ ref, patch }] }`.
 * All rows are written in one transaction so a save lands whole; a row that
 * cannot be found is reported back rather than failing the rest.
 */
export async function PATCH(request: Request) {
  if(!isSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  try {
    const body = await request.json();
    const updates = Array.isArray(body?.updates) ? (body.updates as Array<{ ref: string; patch: Record<string, unknown> }>) : null;
    if (!updates) return NextResponse.json({ error: "Faltan los cambios" }, { status: 400 });
    if (updates.length > 1000) return NextResponse.json({ error: "Demasiados registros a la vez" }, { status: 400 });

    const saved: Record<string, ArtworkRow> = {};
    const failed: Record<string, string> = {};
    const logged: Array<{ before: ArtworkRow; after: ArtworkRow }> = [];

    getDb().transaction(() => {
      for (const { ref, patch } of updates) {
        const before = getArtwork(String(ref));
        if (!before || before.ref !== String(ref)) {
          failed[ref] = "No encontrado";
          continue;
        }
        const after = updateArtwork(before.ref, patch ?? {});
        if (!after) {
          failed[ref] = "No se pudo guardar";
          continue;
        }
        saved[ref] = after;
        logged.push({ before, after });
      }
    })();

    const actor = await currentActor();
    for (const { before, after } of logged) {
      const changes = diffRows(before, after);
      if (changes.length === 0) continue;
      record({
        actor,
        action: "editar",
        entity: "obra",
        entityId: String(after.ref),
        summary: `${after.registro} · ${changes.length} campo(s) · hoja`,
        changes,
      });
    }

    return NextResponse.json({ saved, failed });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
