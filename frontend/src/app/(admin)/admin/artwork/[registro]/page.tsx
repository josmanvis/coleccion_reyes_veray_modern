import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtwork } from "@/lib/inventory/db";
import { FIELDS, isForSale, titleCase } from "@/lib/inventory/fields";
import EditForm from "@/components/inventory/EditForm";
import ArtworkActions from "@/components/inventory/ArtworkActions";
import CertificatePanel from "@/components/inventory/CertificatePanel";
import { artistName } from "@/lib/inventory/fields";
import { mediumLine } from "@/lib/inventory/certificates";
import { getTr } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ registro: string }> };

export async function generateMetadata({ params }: Props) {
  const { registro } = await params;
  const tr = await getTr();
  return { title: `${tr("Editar {registro}", { registro })} · ${tr("Inventario")}` };
}

export default async function EditArtworkPage({ params }: Props) {
  const tr = await getTr();
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
          <p className="font-mono text-xs text-[var(--ink-3)]">{tr("CRV #{n}", { n: artwork.registro })}</p>
          <h1 className="text-2xl leading-tight">
            {artwork.title ? titleCase(String(artwork.title)) : tr("Sin título")}
          </h1>
        </div>
        <Link
          href={`/inventory/${artwork.ref}`}
          className="rounded border border-[var(--stroke)] px-3 py-1.5 text-sm text-[var(--ink-2)] transition hover:bg-[var(--hover)] hover:text-[var(--ink-1)]"
        >
          
          {tr("Ver ficha")}
        </Link>
      </div>

      <EditForm registro={String(artwork.ref)} initial={initial} />

      <div className="mt-12 border-t border-[var(--stroke-soft)] pt-8">
        <CertificatePanel
          refId={String(artwork.ref)}
          defaults={{
            artist: artistName(artwork),
            title: artwork.title ? titleCase(String(artwork.title)) : "",
            medium: mediumLine(
              artwork.technique === null ? null : String(artwork.technique),
              artwork.support === null ? null : String(artwork.support)
            ),
            dimensions: artwork.dimensions === null ? "" : String(artwork.dimensions),
            year: artwork.year === null ? "" : String(artwork.year),
            edition: artwork.edition === null ? "" : String(artwork.edition),
            exhibitions: artwork.exhibition_history === null ? "" : String(artwork.exhibition_history),
            publications: artwork.publication_history === null ? "" : String(artwork.publication_history),
          }}
        />
      </div>

      <div className="mt-12 border-t border-[var(--stroke-soft)] pt-8">
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
