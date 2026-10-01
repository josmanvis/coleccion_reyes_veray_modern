import { cookies } from "next/headers";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { SESSION_COOKIE, canManageUsers, readSession } from "@/lib/inventory/session";
import { auditFacets, listEntries, verifyChain } from "@/lib/inventory/audit";
import { CARD, MUTED } from "@/components/inventory/ui";
import HistoryFilters from "@/components/inventory/HistoryFilters";
import HistoryList from "@/components/inventory/HistoryList";
import { getTr } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const tr = await getTr();
  return { title: tr("Historial · CRVMGMT") };
}

const PER_PAGE = 60;

type Search = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function HistoryPage({ searchParams }: { searchParams: Search }) {
  const tr = await getTr();
  const store = await cookies();
  const session = await readSession(store.get(SESSION_COOKIE)?.value);
  const params = await searchParams;

  // Staff see their own trail; administrators see everyone's.
  const isAdmin = session ? canManageUsers(session.role) : false;
  const requestedUser = Number(one(params.user)) || undefined;
  const page = Math.max(1, Number(one(params.page)) || 1);

  const { entries, total } = listEntries({
    userId: isAdmin ? requestedUser : session?.userId,
    entity: one(params.entity) || undefined,
    action: one(params.action) || undefined,
    search: one(params.q) || undefined,
    from: one(params.from) || undefined,
    to: one(params.to) || undefined,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });

  const facets = auditFacets();
  // Only the superadmin is shown the integrity check: it is a statement about
  // whether anyone has been at the database file, not day-to-day information.
  const chain = session?.role === "superadmin" ? verifyChain() : null;

  return (
    <>
      <div className="border-b border-[var(--stroke-soft)] bg-[var(--surface)]">
        <div className="px-6 py-3">
          <h1 className="text-xl font-semibold leading-tight text-[var(--ink-1)]">{tr("Historial")}</h1>
          <p className={`mt-0.5 text-sm ${MUTED}`}>
            {isAdmin
              ? tr("Todo lo que se ha hecho en CRVMGMT, firmado y en orden.")
              : tr("Lo que tú has hecho en CRVMGMT.")}
          </p>
        </div>
      </div>

      <div className="space-y-4 px-6 py-4">
        {chain && (
          <div
            className={`${CARD} flex items-start gap-3 p-3 ${
              chain.ok ? "" : "border-[color:var(--danger)]/40 bg-[var(--danger-soft)]"
            }`}
          >
            {chain.ok ? (
              <ShieldCheck
                size={18}
                strokeWidth={1.75}
                aria-hidden
                className="mt-0.5 shrink-0 text-[var(--success)]"
              />
            ) : (
              <ShieldAlert
                size={18}
                strokeWidth={1.75}
                aria-hidden
                className="mt-0.5 shrink-0 text-[var(--danger)]"
              />
            )}
            <div>
              <p className="text-sm font-medium text-[var(--ink-1)]">
                {chain.ok
                  ? tr("{n} entrada(s) verificadas", { n: chain.total })
                  : tr("Historial alterado en la entrada {n}", { n: chain.brokenAt ?? "" })}
              </p>
              <p className={`mt-0.5 text-sm ${MUTED}`}>
                {chain.ok
                  ? tr("Cada entrada conserva su firma y enlaza con la anterior.")
                  : chain.reason}
              </p>
            </div>
          </div>
        )}

        <HistoryFilters facets={facets} canFilterUser={isAdmin} />

        <HistoryList entries={entries} total={total} page={page} perPage={PER_PAGE} />
      </div>
    </>
  );
}
