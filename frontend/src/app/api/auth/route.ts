import { NextResponse } from "next/server";
import { authenticate, changeOwnPassword, getUser } from "@/lib/inventory/users";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSession, readSession } from "@/lib/inventory/session";
import { record } from "@/lib/inventory/audit";
import { isIntranetRequest } from "@/lib/inventory/network";
import { leave } from "@/lib/inventory/presence";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (!process.env.INVENTORY_PASSWORD && !process.env.CRVMGMT_SECRET) {
    return NextResponse.json(
      { error: "Falta definir CRVMGMT_SECRET (o INVENTORY_PASSWORD) en .env.local" },
      { status: 503 }
    );
  }
  if (!username || !password) {
    return NextResponse.json({ error: "Usuario y contraseña son obligatorios" }, { status: 400 });
  }

  const origin = isIntranetRequest(request.headers.get("host")) ? "red local" : "esta computadora";
  const user = authenticate(username, password);

  if (!user) {
    // A failed attempt is worth more in the log than a successful one.
    record({
      actor: { id: null, name: username || "(sin usuario)", role: "", origin },
      action: "intento fallido",
      entity: "sesión",
      summary: `Contraseña incorrecta para "${username}"`,
    });
    // Same message either way: never reveal which half was wrong.
    return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

  record({
    actor: { id: user.id, name: user.name, role: user.role, origin },
    action: "entrar",
    entity: "sesión",
    entityId: String(user.id),
    summary: `${user.name} inició sesión desde ${origin}`,
  });

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, role: user.role, mustChange: user.must_change === 1 },
  });
  response.cookies.set(SESSION_COOKIE, await createSession(user.id, user.role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

/** Changing your own password, which also clears the reset flag. */
export async function PATCH(request: Request) {
  const session = await readSession(
    request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1)
  );
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  try {
    const user = changeOwnPassword(session.userId, String(body?.current ?? ""), String(body?.next ?? ""));
    record({
      actor: {
        id: user.id,
        name: user.name,
        role: user.role,
        origin: isIntranetRequest(request.headers.get("host")) ? "red local" : "esta computadora",
      },
      action: "cambiar contraseña",
      entity: "usuario",
      entityId: String(user.id),
      summary: `${user.name} cambió su propia contraseña`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  const session = await readSession(token);
  if (session) {
    // Signing out takes the tab out of the presence bar at once rather than
    // waiting for its heartbeat to go stale.
    const body = await request.json().catch(() => null);
    if (body?.presence) leave(String(body.presence));

    record({
      actor: {
        id: session.userId,
        name: getUser(session.userId)?.name ?? `Usuario ${session.userId}`,
        role: session.role,
        origin: isIntranetRequest(request.headers.get("host")) ? "red local" : "esta computadora",
      },
      action: "salir",
      entity: "sesión",
      entityId: String(session.userId),
      summary: "Cerró sesión",
    });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
