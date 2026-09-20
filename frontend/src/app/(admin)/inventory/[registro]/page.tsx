import Link from "next/link";
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

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ registro: string }> };

export async function generateMetadata({ params }: Props) {
  const { registro } = await params;
  const artwork = getArtwork(registro);
  if (!artwork) return { title: "No encontrada" };
  return { title: `${titleCase(String(artwork.title ?? registro))} · Inventario` };
}

export default async function ArtworkPage({ params }: Props) {
  const { registro } = await params;
  const artwork = getArtwork(registro);
  if (!artwork) notFound();

  const groups = Object.keys(GROUP_LABELS) as FieldGroup[];
  const artistHref = artistHrefFor(artwork, artistSlugIndex());

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
        <Link href="/inventory" className="text-sm text-neutral-600 transition hover:text-black">
          ← Volver al inventario
        </Link>
        <div className="flex items-center gap-2 text-sm">
          {artwork.website_slug && (
            <Link
              href={`/art/${artwork.website_slug}`}
              className="rounded border border-neutral-300 px-3 py-1.5 text-neutral-700 transition hover:border-neutral-600 hover:text-black"
            >
              Ver en el sitio
            </Link>
          )}
          <Link
            href={`/admin/artwork/${artwork.ref}`}
            className="rounded bg-black px-3 py-1.5 text-white transition hover:bg-neutral-700"
          >
            Editar
          </Link>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[420px_1fr]">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-sm bg-neutral-100">
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
              <span className="flex size-full items-center justify-center text-sm text-neutral-500">
                Sin imagen enlazada
              </span>
            )}
          </div>

          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-neutral-200 pb-2">
              <dt className="text-neutral-500">Valor actual</dt>
              <dd className="tabular-nums">{formatMoney(artwork.current_value)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-neutral-200 pb-2">
              <dt className="text-neutral-500">Precio de compra</dt>
              <dd className="tabular-nums">{formatMoney(artwork.purchase_price)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Última actualización</dt>
              <dd className="text-neutral-700">{artwork.updated_at}</dd>
            </div>
          </dl>
        </div>

        <div>
          <p className="font-mono text-xs text-neutral-500">CRV #{artwork.registro}</p>
          <h1 className="mt-1 font-serif text-4xl leading-tight">
            {artwork.title ? titleCase(String(artwork.title)) : "Sin título"}
          </h1>
          <p className="mt-1 text-lg text-neutral-700">
            {artistHref ? (
              <Link href={artistHref} className="transition hover:text-black hover:underline">
                {artistName(artwork)}
              </Link>
            ) : (
              artistName(artwork)
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill group={artwork.status_group} />
            {artwork.status && <span className="text-sm text-neutral-600">{String(artwork.status)}</span>}
          </div>

          <div className="mt-8 space-y-8">
            {groups.map((group) => {
              const fields = FIELDS.filter(
                (f) => f.group === group && artwork[f.key] !== null && artwork[f.key] !== ""
              );
              if (fields.length === 0) return null;

              return (
                <section key={group}>
                  <h2 className="border-b border-neutral-200 pb-1.5 text-xs uppercase tracking-wide text-neutral-500">
                    {GROUP_LABELS[group]}
                  </h2>
                  <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {fields.map((field) => {
                      const value = artwork[field.key];
                      const isLong = field.type === "longtext";
                      return (
                        <div key={field.key} className={isLong ? "sm:col-span-2" : ""}>
                          <dt className="text-xs text-neutral-500">{field.label}</dt>
                          <dd
                            className={`mt-0.5 text-sm ${
                              isLong ? "whitespace-pre-line leading-relaxed text-neutral-800" : ""
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
    </main>
  );
}
