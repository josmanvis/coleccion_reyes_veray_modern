import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, canManageUsers, readSession } from "@/lib/inventory/session";
import { readSettings, writeSettings } from "@/lib/inventory/settings";
import { record, type AuditChange } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ settings: readSettings() });
}

/** Settings affect everyone, so only an administrator may change them. */
export async function POST(request: Request) {
  const store = await cookies();
  const session = await readSession(store.get(SESSION_COOKIE)?.value);
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const before = readSettings();
  const settings = writeSettings(body as Record<string, unknown>);

  const changes: AuditChange[] = Object.keys(settings)
    .filter((key) => settings[key as keyof typeof settings] !== before[key as keyof typeof before])
    .map((key) => ({
      field: key,
      label: key,
      // A connection string can carry a password, so only the fact that it
      // changed is recorded.
      before: key.includes("odbcConnection") ? "•••" : before[key as keyof typeof before],
      after: key.includes("odbcConnection") ? "•••" : settings[key as keyof typeof settings],
    }));

  if (changes.length > 0) {
    record({
      actor: await currentActor(),
      action: "ajustes",
      entity: "ajustes",
      summary: changes.map((c) => c.field).join(", "),
      changes,
    });
  }

  return NextResponse.json({ settings });
}
