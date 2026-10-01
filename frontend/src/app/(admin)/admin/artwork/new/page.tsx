import Link from "next/link";
import { nextRegistro } from "@/lib/inventory/db";
import NewArtworkForm from "@/components/inventory/NewArtworkForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nueva obra · Inventario" };

export default async function NewArtworkPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <p className="font-mono text-xs text-[var(--ink-3)]">Nueva ficha</p>
          <h1 className="text-2xl leading-tight">Añadir obra</h1>
        </div>
        <Link
          href="/inventory"
          className="rounded border border-[var(--stroke)] px-3 py-1.5 text-sm text-[var(--ink-2)] transition hover:bg-[var(--hover)] hover:text-[var(--ink-1)]"
        >
          Volver al inventario
        </Link>
      </div>

      <NewArtworkForm suggestedRegistro={nextRegistro()} />
    </main>
  );
}
