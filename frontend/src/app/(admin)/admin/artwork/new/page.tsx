import Link from "next/link";
import { nextRegistro } from "@/lib/inventory/db";
import NewArtworkForm from "@/components/inventory/NewArtworkForm";
import { getTr } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const tr = await getTr();
  return { title: tr("Nueva obra · Inventario") };
}

export default async function NewArtworkPage() {
  const tr = await getTr();
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <p className="font-mono text-xs text-[var(--ink-3)]">{tr("Nueva ficha")}</p>
          <h1 className="text-2xl leading-tight">{tr("Añadir obra")}</h1>
        </div>
        <Link
          href="/inventory"
          className="rounded border border-[var(--stroke)] px-3 py-1.5 text-sm text-[var(--ink-2)] transition hover:bg-[var(--hover)] hover:text-[var(--ink-1)]"
        >
          
          {tr("Volver al inventario")}
        </Link>
      </div>

      <NewArtworkForm suggestedRegistro={nextRegistro()} />
    </main>
  );
}
