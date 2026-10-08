import {isSameOrigin} from "@/lib/site-config";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/inventory/session";
import { readSession } from "@/lib/inventory/session-server";
import { getUser, setAppearance } from "@/lib/inventory/users";
import { normalizeHex } from "@/lib/inventory/theme";
import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";

export const dynamic = "force-dynamic";

/**
 * A person's own appearance. Deliberately not behind the administrator check
 * the rest of the settings sit behind: the accent and the picture belong to
 * whoever is signed in, and only ever change their own row.
 */
export async function PATCH(request: Request) {
  if(!isSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  const store = await cookies();
  const session = await readSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const patch: { accent?: string; avatar?: string | null } = {};
  if (typeof body.accent === "string") patch.accent = normalizeHex(body.accent);
  if ("avatar" in body) patch.avatar = body.avatar === null ? null : String(body.avatar);

  try {
    const user = setAppearance(session.userId, patch);
    const what = [
      patch.accent !== undefined ? "color" : null,
      patch.avatar !== undefined ? (patch.avatar ? "imagen" : "imagen quitada") : null,
    ].filter(Boolean);

    if (what.length > 0) {
      record({
        actor: await currentActor(),
        action: "apariencia",
        entity: "usuario",
        entityId: String(user.id),
        summary: `${user.name} cambió su ${what.join(" y ")}`,
      });
    }

    return NextResponse.json({
      user: { id: user.id, name: user.name, accent: user.accent, avatar: user.avatar },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function GET() {
  const store = await cookies();
  const session = await readSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = getUser(session.userId);
  if (!user) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role, accent: user.accent, avatar: user.avatar },
  });
}
