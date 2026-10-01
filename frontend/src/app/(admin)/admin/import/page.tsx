import { latestSession, listChanges } from "@/lib/inventory/import-staging";
import { MUTED } from "@/components/inventory/ui";
import ImportReview from "@/components/inventory/ImportReview";
import { getTr } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const tr = await getTr();
  return { title: tr("Importar · Inventario") };
}

export default async function ImportPage() {
  const tr = await getTr();
  const session = latestSession();
  const changes = session ? listChanges(session.id) : [];

  return (
    <>
      <div className="border-b border-[var(--stroke-soft)] bg-[var(--surface)]">
        <div className="px-6 py-3">
          <h1 className="text-xl font-semibold leading-tight text-[var(--ink-1)]">
            
            {tr("Importar desde FileMaker")}
          </h1>
          <p className={`mt-0.5 text-sm ${MUTED}`}>
            
            {tr("Compara una exportación con los registros y aplica solo lo que confirmes.")}
          </p>
        </div>
      </div>

      <div className="px-6 py-4">
        <ImportReview session={session} changes={changes} />
      </div>
    </>
  );
}
