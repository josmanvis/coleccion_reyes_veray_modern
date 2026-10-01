import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, readSession } from "@/lib/inventory/session";
import { HEARTBEAT_SECONDS, heartbeat, leave, present } from "@/lib/inventory/presence";
import { isIntranetRequest } from "@/lib/inventory/network";

export const dynamic = "force-dynamic";

/**
 * The heartbeat, and the answer to "who else is here".
 *
 * One call does both so an open tab makes a single request on its cycle rather
 * than a write and a read.
 */
export async function POST(request: Request) {
  const store = await cookies();
  const session = await readSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "Falta el identificador" }, { status: 400 });

  const origin = isIntranetRequest((await headers()).get("host")) ? "red local" : "escritorio";

  if (body?.leaving) {
    leave(token);
  } else {
    heartbeat({
      token,
      userId: session.userId,
      state: body?.state,
      page: String(body?.page ?? ""),
      origin,
    });
  }

  return NextResponse.json({
    users: present(),
    me: session.userId,
    everySeconds: HEARTBEAT_SECONDS,
  });
}

export async function GET() {
  const store = await cookies();
  const session = await readSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ users: present(), me: session.userId });
}
