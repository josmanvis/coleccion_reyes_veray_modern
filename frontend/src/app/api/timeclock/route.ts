import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, canManageUsers, readSession } from "@/lib/inventory/session";
import {
  adjustShift,
  clockIn,
  clockOut,
  deleteShift,
  listShifts,
  openShift,
  totalsByUser,
} from "@/lib/inventory/timeclock";
import { isIntranetRequest } from "@/lib/inventory/network";
import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";
import { getUser } from "@/lib/inventory/users";

export const dynamic = "force-dynamic";

async function session() {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
}

export async function GET(request: Request) {
  const claims = await session();
  if (!claims) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const requested = Number(searchParams.get("userId") ?? 0);

  // Anyone may read their own hours; only an administrator sees everyone's.
  const scope = canManageUsers(claims.role) ? requested || undefined : claims.userId;

  const query = {
    userId: scope,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    limit: Math.min(500, Number(searchParams.get("limit") ?? 100)),
    offset: Number(searchParams.get("offset") ?? 0),
  };

  return NextResponse.json({
    ...listShifts(query),
    totals: canManageUsers(claims.role)
      ? totalsByUser({ from: query.from, to: query.to, userId: scope })
      : totalsByUser({ ...query, userId: claims.userId }),
    open: openShift(claims.userId),
    canAdjust: claims.role === "superadmin",
    me: claims.userId,
  });
}

export async function POST(request: Request) {
  const claims = await session();
  if (!claims) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const who = await currentActor();
  const origin = isIntranetRequest((await headers()).get("host")) ? "red local" : "escritorio";

  try {
    switch (body?.action) {
      case "in": {
        const shift = clockIn(claims.userId, origin);
        record({
          actor: who,
          action: "entrada",
          entity: "jornada",
          entityId: String(shift.id),
          summary: `${who.name} marcó entrada desde ${origin}`,
        });
        return NextResponse.json({ shift });
      }
      case "out": {
        const shift = clockOut(claims.userId, String(body.note ?? ""));
        record({
          actor: who,
          action: "salida",
          entity: "jornada",
          entityId: String(shift.id),
          summary: `${who.name} marcó salida · ${Math.round(shift.minutes)} min`,
        });
        return NextResponse.json({ shift });
      }

      // Correcting somebody's hours is the superadmin's alone, and is always
      // written to the history with the reason given.
      case "adjust": {
        if (claims.role !== "superadmin") {
          return NextResponse.json(
            { error: "Solo el superadministrador puede ajustar horas" },
            { status: 403 }
          );
        }
        const editor = getUser(claims.userId);
        const { before, after } = adjustShift(
          Number(body.id),
          {
            startedAt: body.startedAt ? String(body.startedAt) : undefined,
            endedAt: body.endedAt === null ? null : body.endedAt ? String(body.endedAt) : undefined,
            note: body.note === undefined ? undefined : String(body.note),
            reason: String(body.reason ?? ""),
          },
          { id: claims.userId, name: editor?.name ?? `Usuario ${claims.userId}` }
        );

        record({
          actor: who,
          action: "ajustar jornada",
          entity: "jornada",
          entityId: String(after.id),
          summary: `Horas de ${after.userName} ajustadas · ${after.editReason}`,
          changes: [
            { field: "started_at", label: "Entrada", before: before.startedAt, after: after.startedAt },
            {
              field: "ended_at",
              label: "Salida",
              before: before.endedAt ?? "(abierta)",
              after: after.endedAt ?? "(abierta)",
            },
            {
              field: "minutes",
              label: "Duración",
              before: String(before.minutes),
              after: String(after.minutes),
            },
            { field: "reason", label: "Motivo", before: "", after: after.editReason },
          ].filter((change) => change.before !== change.after),
        });

        return NextResponse.json({ shift: after });
      }
      case "delete": {
        if (claims.role !== "superadmin") {
          return NextResponse.json(
            { error: "Solo el superadministrador puede eliminar horas" },
            { status: 403 }
          );
        }
        const reason = String(body.reason ?? "").trim();
        if (!reason) {
          return NextResponse.json({ error: "Hace falta indicar el motivo" }, { status: 400 });
        }
        const removed = deleteShift(Number(body.id), who, reason);
        if (!removed) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

        record({
          actor: who,
          action: "eliminar jornada",
          entity: "jornada",
          entityId: String(removed.id),
          summary: `Jornada de ${removed.userName} eliminada · ${reason}`,
          changes: [
            { field: "started_at", label: "Entrada", before: removed.startedAt, after: "" },
            { field: "ended_at", label: "Salida", before: removed.endedAt ?? "(abierta)", after: "" },
            { field: "reason", label: "Motivo", before: "", after: reason },
          ],
        });
        return NextResponse.json({ ok: true, trashId: removed.trashId });
      }
      default:
        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
