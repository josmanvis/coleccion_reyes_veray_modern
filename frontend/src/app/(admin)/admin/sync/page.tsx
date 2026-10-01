import { headers } from "next/headers";
import { MonitorOff } from "lucide-react";
import SyncReview from "@/components/inventory/SyncReview";
import { MUTED } from "@/components/inventory/ui";
import { checkAppleScript, checkOdbc, listDatabases } from "@/lib/inventory/filemaker";
import { latestSyncRun, listSyncFields } from "@/lib/inventory/filemaker-sync";
import { isIntranetRequest } from "@/lib/inventory/network";
import { CARD } from "@/components/inventory/ui";
import { getTr } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const tr = await getTr();
  return { title: tr("Sincronizar · CRVMGMT") };
}

async function SyncUnavailable() {
  const tr = await getTr();
  return (
    <>
      <div className="border-b border-[var(--stroke-soft)] bg-[var(--surface)]">
        <div className="px-6 py-3">
          <h1 className="text-xl font-semibold leading-tight text-[var(--ink-1)]">
            
            {tr("Sincronizar con FileMaker Pro")}
          </h1>
        </div>
      </div>
      <div className="px-6 py-4">
        <div className={`${CARD} flex items-start gap-3 p-4`}>
          <MonitorOff size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--ink-1)]">
              
              {tr("Solo en la computadora donde corre CRVMGMT")}
            </p>
            <p className={`mt-1 text-sm ${MUTED}`}>
              
              {tr("La sincronización trabaja con el archivo .fmp12 y con FileMaker Pro abiertos en esa máquina. Desde la red puedes usar todo lo demás del inventario.")}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default async function SyncPage() {
  const tr = await getTr();
  // Probing FileMaker means driving the copy on this desktop. For someone on
  // another machine there is nothing to probe, so say so instead of running it.
  const remote = isIntranetRequest((await headers()).get("host"));
  if (remote) return <SyncUnavailable />;

  const [applescript, odbc] = await Promise.all([checkAppleScript(), checkOdbc()]);
  const databases = applescript.available ? await listDatabases().catch(() => []) : [];
  const run = latestSyncRun();

  const initial = {
    applescript,
    odbc,
    databases,
    run,
    fields: run ? listSyncFields(run.id) : [],
  };

  return (
    <>
      <div className="border-b border-[var(--stroke-soft)] bg-[var(--surface)]">
        <div className="px-6 py-3">
          <h1 className="text-xl font-semibold leading-tight text-[var(--ink-1)]">
            
            {tr("Sincronizar con FileMaker Pro")}
          </h1>
          <p className={`mt-0.5 text-sm ${MUTED}`}>
            
            {tr("Compara ambos sistemas campo por campo. Nada se escribe hasta que elijas una dirección.")}
          </p>
        </div>
      </div>
      <div className="px-6 py-4">
        <SyncReview initial={initial} />
      </div>
    </>
  );
}
