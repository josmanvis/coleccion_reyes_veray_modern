import { cookies } from "next/headers";
import { SESSION_COOKIE, canManageUsers, readSession } from "@/lib/inventory/session";
import { listShifts, openShift, totalsByUser } from "@/lib/inventory/timeclock";
import { listUsers } from "@/lib/inventory/users";
import { MUTED } from "@/components/inventory/ui";
import HoursBoard from "@/components/inventory/HoursBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Horas · CRVMGMT" };

type Search = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** Defaults to the current month, which is the span anyone actually asks about. */
function defaultRange() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: first.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

export default async function HoursPage({ searchParams }: { searchParams: Search }) {
  const store = await cookies();
  const session = await readSession(store.get(SESSION_COOKIE)?.value);
  const params = await searchParams;

  const isAdmin = session ? canManageUsers(session.role) : false;
  const range = defaultRange();
  const from = one(params.from) || range.from;
  const to = one(params.to) || range.to;

  // Staff only ever see their own hours, whatever the query string says.
  const requested = Number(one(params.user)) || undefined;
  const userId = isAdmin ? requested : session?.userId;

  const { shifts, minutes } = listShifts({ userId, from, to, limit: 400 });

  return (
    <>
      <div className="border-b border-[var(--stroke-soft)] bg-[var(--surface)]">
        <div className="px-6 py-3">
          <h1 className="text-xl font-semibold leading-tight text-[var(--ink-1)]">Horas</h1>
          <p className={`mt-0.5 text-sm ${MUTED}`}>
            {isAdmin
              ? "Entradas y salidas del equipo. Solo el superadministrador puede corregirlas."
              : "Tus entradas y salidas."}
          </p>
        </div>
      </div>

      <div className="px-6 py-4">
        <HoursBoard
          shifts={shifts}
          totals={totalsByUser({ userId, from, to })}
          totalMinutes={minutes}
          people={isAdmin ? listUsers().map((u) => ({ id: u.id, name: u.name })) : []}
          from={from}
          to={to}
          selectedUser={userId ?? null}
          canAdjust={session?.role === "superadmin"}
          isAdmin={isAdmin}
          openShiftId={session ? (openShift(session.userId)?.id ?? null) : null}
        />
      </div>
    </>
  );
}
