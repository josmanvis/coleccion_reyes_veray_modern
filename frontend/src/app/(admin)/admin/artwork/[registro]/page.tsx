import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtwork } from "@/lib/inventory/db";
import { FIELDS, isForSale, titleCase } from "@/lib/inventory/fields";
import EditForm from "@/components/inventory/EditForm";
import ArtworkActions from "@/components/inventory/ArtworkActions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ registro: string }> };

export async function generateMetadata({ params }: Props) {
  const { registro } = await params;
  return { title: `Editar ${registro} · Inventario` };
}

export default async function EditArtworkPage({ params }: Props) {
  const { registro } = await params;
  const artwork = getArtwork(registro);
  if (!artwork) notFound();

  const initial = Object.fromEntries(
    FIELDS.map((field) => [field.key, artwork[field.key] === null ? "" : String(artwork[field.key])])
  );

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <p className="font-mono text-xs text-neutral-500">CRV #{artwork.registro}</p>
          <h1 className="font-serif text-2xl leading-tight">
            {artwork.title ? titleCase(String(artwork.title)) : "Sin título"}
          </h1>
        </div>
        <Link
          href={`/inventory/${artwork.ref}`}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:border-neutral-600 hover:text-black"
        >
          Ver ficha
        </Link>
      </div>

      <EditForm registro={String(artwork.ref)} initial={initial} />

      <div className="mt-12 border-t border-neutral-200 pt-8">
        <ArtworkActions
          refId={String(artwork.ref)}
          registro={String(artwork.registro)}
          sales={artwork.sales === null ? null : String(artwork.sales)}
          forSale={isForSale(artwork.sales)}
          deaccessed={artwork.status_group === "de_accessed"}
          status={artwork.status === null ? null : String(artwork.status)}
        />
      </div>
    </main>
  );
}
