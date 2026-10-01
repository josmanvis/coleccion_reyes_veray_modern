import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, canManageUsers, readSession } from "@/lib/inventory/session";
import { TRASH_ENTITY_LABELS, listTrash, purgeFromTrash, restoreFromTrash } from "@/lib/inventory/trash";
import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ items: listTrash() });
}

/**
 * `{ action: "restore" | "purge", id }`. Anyone signed in can restore what
 * they could delete; deleting for good is for administrators, since it is
 * the one step that cannot be taken back.
 */
export async function POST(request: Request) {
  const store = await cookies();
  const session = await readSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

  const item = listTrash().find((entry) => entry.id === id);
  if (!item) return NextResponse.json({ error: "No está en la papelera" }, { status: 404 });

  const actor = await currentActor();
  const kind = TRASH_ENTITY_LABELS[item.entity] ?? item.entity;

  try {
    if (body.action === "restore") {
      // Shifts can only be deleted by the superadministrator, so only they bring one back.
      if (item.entity === "jornada" && session.role !== "superadmin") {
        return NextResponse.json({ error: "Solo el superadministrador puede restaurar horas" }, { status: 403 });
      }
      const restored = restoreFromTrash(id);
      record({
        actor,
        action: "restaurar",
        entity: item.entity,
        entityId: restored.entityId,
        summary: `Restauración desde la papelera: ${kind.toLowerCase()} «${restored.label}»`,
      });
      return NextResponse.json({ ok: true, href: restored.href });
    }

    if (body.action === "purge") {
      if (!canManageUsers(session.role)) {
        return NextResponse.json({ error: "Solo un administrador puede eliminar definitivamente" }, { status: 403 });
      }
      const purged = purgeFromTrash(id);
      record({
        actor,
        action: "eliminar definitivamente",
        entity: item.entity,
        entityId: purged.entityId,
        summary: `Eliminación definitiva: ${kind.toLowerCase()} «${purged.label}»`,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 409 });
  }
}
