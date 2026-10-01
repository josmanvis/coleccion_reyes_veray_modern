import Link from "next/link";
import { ExternalLink, Pencil, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getArtwork } from "@/lib/inventory/db";
import { artistHrefFor, artistSlugIndex } from "@/lib/inventory/public";
import {
  FIELDS,
  GROUP_LABELS,
  artistName,
  formatMoney,
  titleCase,
  type FieldGroup,
} from "@/lib/inventory/fields";
import { StatusPill } from "@/components/inventory/InventoryTable";
import CertificatePanel from "@/components/inventory/CertificatePanel";
import IssuedCertificates from "@/components/inventory/IssuedCertificates";
import { mediumLine } from "@/lib/inventory/certificates";
import { certificatesForArtwork } from "@/lib/inventory/certificate-log";
import { PUBLIC_SITE_ENABLED } from "@/lib/site-config";
import { MUTED } from "@/components/inventory/ui";
import { Award } from "lucide-react";
import { getTr } from "@/lib/i18n-server";
import { artworkCtx, fieldCtx } from "@/components/inventory/context-data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ registro: string }> };

export async function generateMetadata({ params }: Props) {
  const { registro } = await params;
  const artwork = getArtwork(registro);
  const tr = await getTr();
  if (!artwork) return { title: tr("No encontrada") };
  return { title: `${titleCase(String(artwork.title ?? registro))} · ${tr("Inventario")}` };
}

export default async function ArtworkPage({ params }: Props) {
  const tr = await getTr();
  const { registro } = await params;
  const artwork = getArtwork(registro);
  if (!artwork) notFound();

  const groups = Object.keys(GROUP_LABELS) as FieldGroup[];
  const artistHref = artistHrefFor(artwork, artistSlugIndex());

  const issued = certificatesForArtwork(String(artwork.ref), String(artwork.registro ?? ""));

  const certificateDefaults = {
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
  };

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-6" {...artworkCtx(artwork)}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
        <Link href="/inventory" className="inline-flex items-center gap-1.5 text-sm text-[var(--ink-3)] transition hover:text-[var(--ink-1)]">
          <ArrowLeft size={15} strokeWidth={1.75} aria-hidden />
          
          {tr("Volver al inventario")}
        </Link>
        <div className="flex items-center gap-2 text-sm">
          {PUBLIC_SITE_ENABLED && artwork.website_slug && (
            <Link
              href={`/art/${artwork.website_slug}`}
              className="rounded border border-[var(--stroke)] px-3 py-1.5 text-[var(--ink-2)] transition hover:bg-[var(--hover)] hover:text-[var(--ink-1)]"
            >
              <ExternalLink size={15} strokeWidth={1.75} aria-hidden />
              
              {tr("Ver en el sitio")}
            </Link>
          )}
          <CertificatePanel
            variant="drawer"
            refId={String(artwork.ref)}
            defaults={certificateDefaults}
          />
          <Link
            href={`/admin/artwork/${artwork.ref}`}
            className="rounded bg-[var(--brand)] px-3 py-1.5 text-white transition hover:bg-[var(--brand-hover)]"
          >
            <Pencil size={15} strokeWidth={1.75} aria-hidden />
            
            {tr("Editar")}
          </Link>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[420px_1fr]">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-sm bg-[var(--hover)]">
            {artwork.image_full || artwork.image_thumb ? (
              <Image
                src={String(artwork.image_full || artwork.image_thumb)}
                alt={String(artwork.title ?? "")}
                fill
                sizes="420px"
                className="object-contain"
                unoptimized
              />
            ) : (
              <span className="flex size-full items-center justify-center text-sm text-[var(--ink-3)]">
                
                {tr("Sin imagen enlazada")}
              </span>
            )}
          </div>

          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-[var(--stroke-soft)] pb-2">
              <dt className="text-[var(--ink-3)]">{tr("Valor actual")}</dt>
              <dd className="tabular-nums">{formatMoney(artwork.current_value)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--stroke-soft)] pb-2">
              <dt className="text-[var(--ink-3)]">{tr("Precio de compra")}</dt>
              <dd className="tabular-nums">{formatMoney(artwork.purchase_price)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--ink-3)]">{tr("Última actualización")}</dt>
              <dd className="text-[var(--ink-2)]">{artwork.updated_at}</dd>
            </div>
          </dl>
        </div>

        <div>
          <p className="font-mono text-xs text-[var(--ink-3)]">CRV #{artwork.registro}</p>
          <h1 className="mt-1 text-4xl leading-tight">
            {artwork.title ? titleCase(String(artwork.title)) : tr("Sin título")}
          </h1>
          <p className="mt-1 text-lg text-[var(--ink-2)]">
            {artistHref ? (
              <Link href={artistHref} className="transition hover:text-[var(--ink-1)] hover:underline">
                {artistName(artwork)}
              </Link>
            ) : (
              artistName(artwork)
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill group={artwork.status_group} />
            {artwork.status && <span className="text-sm text-[var(--ink-3)]">{String(artwork.status)}</span>}
          </div>

          <div className="mt-8 space-y-8">
            {groups.map((group) => {
              const fields = FIELDS.filter(
                (f) => f.group === group && artwork[f.key] !== null && artwork[f.key] !== ""
              );
              if (fields.length === 0) return null;

              return (
                <section key={group}>
                  <h2 className="border-b border-[var(--stroke-soft)] pb-1.5 text-xs uppercase tracking-wide text-[var(--ink-3)]">
                    {tr(GROUP_LABELS[group])}
                  </h2>
                  <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {fields.map((field) => {
                      const value = artwork[field.key];
                      const isLong = field.type === "longtext";
                      return (
                        <div
                          key={field.key}
                          className={isLong ? "sm:col-span-2" : ""}
                          {...fieldCtx(tr(field.label), value)}
                        >
                          <dt className="text-xs text-[var(--ink-3)]">{tr(field.label)}</dt>
                          <dd
                            className={`mt-0.5 text-sm ${
                              isLong ? "whitespace-pre-line leading-relaxed text-[var(--ink-1)]" : ""
                            }`}
                          >
                            {field.type === "money" ? formatMoney(value) : String(value)}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              );
            })}
          </div>
        </div>
      </div>


      {issued.length > 0 && (
        <section className="mt-10">
          <h2 className={`flex items-center gap-2 border-b border-[var(--stroke-soft)] pb-1.5 text-xs uppercase tracking-wide ${MUTED}`}>
            <Award size={14} strokeWidth={1.75} aria-hidden />
            {tr("Certificados ({n})", { n: issued.length })}
            <Link href="/admin/certificates" className="ml-auto normal-case tracking-normal hover:text-[var(--ink-1)]">
              
              {tr("Ver todos")}
            </Link>
          </h2>
          <IssuedCertificates certificates={issued} />
        </section>
      )}

    </main>
  );
}
