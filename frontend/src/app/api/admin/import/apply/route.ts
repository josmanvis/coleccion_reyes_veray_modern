import { NextResponse } from "next/server";
import { applyChanges, discardSession, getSession, skipChanges } from "@/lib/inventory/import-staging";

import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";

export const dynamic = "force-dynamic";

/** Applies, skips or discards staged changes — never the whole file implicitly. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const sessionId = Number(body?.sessionId);
  if (!sessionId || !getSession(sessionId)) {
    return NextResponse.json({ error: "Revisión no encontrada" }, { status: 404 });
  }

  const ids = Array.isArray(body.changeIds) ? body.changeIds.map(Number).filter(Boolean) : [];

  const who = await currentActor();

  if (body.action === "discard") {
    discardSession(sessionId);
    record({
      actor: who,
      action: "descartar importación",
      entity: "importación",
      entityId: String(sessionId),
      summary: `Revisión ${sessionId} descartada sin aplicar nada`,
    });
    return NextResponse.json({ ok: true, discarded: true });
  }
  if (body.action === "skip") {
    return NextResponse.json({ ok: true, skipped: skipChanges(sessionId, ids) });
  }

  const result = applyChanges(sessionId, ids);
  record({
    actor: who,
    action: "aplicar importación",
    entity: "importación",
    entityId: String(sessionId),
    summary:
      `${result.applied} registro(s) aplicados` +
      (result.failed > 0 ? `, ${result.failed} con error` : ""),
    changes: result.errors.map((error) => ({ field: "error", before: "", after: error })),
  });
  return NextResponse.json({ ...result, session: getSession(sessionId) });
}
