import {isSameOrigin} from "@/lib/site-config";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, canManageUsers, type Role } from "@/lib/inventory/session";
import { readSession } from "@/lib/inventory/session-server";
import { createUser, getUser, listUsers, resetPassword, setActive, setRole } from "@/lib/inventory/users";
import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";
import { ROLE_LABELS } from "@/lib/inventory/session";

export const dynamic = "force-dynamic";

/** Every write here is an administrator action; the session decides. */
async function actor() {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
}

export async function GET() {
  const session = await actor();
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return NextResponse.json({ users: listUsers(), actor: session });
}

export async function POST(request: Request) {
  if(!isSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  const session = await actor();
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const who = await currentActor();

  try {
    switch (body?.action) {
      case "create": {
        const user = createUser({
          username: String(body.username ?? ""),
          name: String(body.name ?? ""),
          role: (body.role ?? "staff") as Role,
          password: String(body.password ?? ""),
        }, session.role);
        record({
          actor: who,
          action: "crear",
          entity: "usuario",
          entityId: String(user.id),
          // Never the password, not even its length.
          summary: `Alta de ${user.name} (${user.username}) como ${ROLE_LABELS[user.role]}`,
        });
        return NextResponse.json({ user });
      }
      case "reset": {
        const user = resetPassword(Number(body.id), String(body.password ?? ""), session.role);
        record({
          actor: who,
          action: "restablecer contraseña",
          entity: "usuario",
          entityId: String(user.id),
          summary: `Contraseña de ${user.name} restablecida`,
        });
        return NextResponse.json({ user });
      }
      case "active": {
        const before = getUser(Number(body.id));
        const user = setActive(Number(body.id), Boolean(body.active));
        record({
          actor: who,
          action: user.active === 1 ? "activar" : "desactivar",
          entity: "usuario",
          entityId: String(user.id),
          summary: `${user.name} ${user.active === 1 ? "activado" : "desactivado"}`,
          changes: [
            { field: "active", label: "Activo", before: String(before?.active ?? ""), after: String(user.active) },
          ],
        });
        return NextResponse.json({ user });
      }
      case "role": {
        const before = getUser(Number(body.id));
        const user = setRole(Number(body.id), body.role as Role, session.role);
        record({
          actor: who,
          action: "cambiar rol",
          entity: "usuario",
          entityId: String(user.id),
          summary: `${user.name}: ${ROLE_LABELS[user.role]}`,
          changes: [
            {
              field: "role",
              label: "Rol",
              before: before ? ROLE_LABELS[before.role] : "",
              after: ROLE_LABELS[user.role],
            },
          ],
        });
        return NextResponse.json({ user });
      }
      default:
        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
