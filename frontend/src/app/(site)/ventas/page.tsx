import Link from "next/link";
import Image from "next/image";
import { listForSale, type SaleListing } from "@/lib/inventory/public";
import { formatMoney } from "@/lib/inventory/fields";
import { t, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

// Driven by the sale flag in the admin, so a toggle shows up immediately.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "For Sale | Colección Reyes-Veray",
  description: "Works currently available from the Colección Reyes-Veray archive.",
};

/** "2000 · Pintura · Acrílico" — only the catalogue facts, never provenance. */
function caption(work: SaleListing): string {
  return [work.year, work.medium, work.technique]
    .filter(Boolean)
    .map((part) => String(part))
    .join(" · ");
}

function Listing({ work, locale }: { work: SaleListing; locale: Locale }) {
  const body = (
    <>
      <div className="relative aspect-square overflow-hidden bg-black/[0.04]">
        {work.image ? (
          <Image
            src={work.image}
            alt={work.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain transition-transform duration-500 group-hover:scale-[1.03]"
            unoptimized
          />
        ) : (
          <span className="flex size-full items-center justify-center font-display text-[10px] uppercase tracking-widest opacity-20">
            {t(locale, "works.noImage")}
          </span>
        )}
      </div>

      <div className="mt-3">
        <p className="font-serif text-lg leading-tight">{work.title}</p>
        <p className="mt-0.5 text-sm opacity-60">{work.artist}</p>
        <p className="mt-1.5 font-display text-[10px] uppercase tracking-widest opacity-40">
          {caption(work)}
        </p>
        {work.dimensions && (
          <p className="font-display text-[10px] uppercase tracking-widest opacity-40">
            {work.dimensions}
          </p>
        )}
        <p className="font-display text-[10px] uppercase tracking-widest opacity-25">
          CRV #{work.registro}
        </p>
      </div>
    </>
  );

  return (
    <li className="group">
      {work.href ? (
        <Link href={work.href} className="block">
          {body}
        </Link>
      ) : (
        body
      )}

      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-black/10 pt-2">
        <span className="font-display text-[10px] uppercase tracking-widest opacity-40">
          {t(locale, work.askingPrice === null ? "sale.onRequest" : "sale.asking")}
        </span>
        {work.askingPrice !== null && (
          <span className="text-sm tabular-nums">{formatMoney(work.askingPrice)}</span>
        )}
      </div>

      {work.artistSlug && (
        <Link
          href={`/${work.artistSlug}`}
          className="mt-1 inline-block font-display text-[10px] uppercase tracking-widest opacity-30 transition-opacity hover:opacity-70"
        >
          {t(locale, "sale.moreByArtist")}
        </Link>
      )}
    </li>
  );
}

export default async function ForSalePage() {
  const locale = await getLocale();
  const works = listForSale();
  const priced = works.filter((work) => work.askingPrice !== null).length;

  return (
    <main className="min-h-screen bg-neutral-100 px-6 pb-24 pt-32 md:px-12">
      <header className="mx-auto max-w-[1400px] border-b border-black/10 pb-8">
        <h1 className="font-serif text-4xl leading-none md:text-6xl">{t(locale, "sale.title")}</h1>
        <p className="mt-3 font-display text-[10px] uppercase tracking-widest opacity-40">
          {t(locale, works.length === 1 ? "sale.availableOne" : "sale.available", {
            n: works.length,
          })}
          {priced < works.length &&
            ` · ${t(locale, "sale.onRequestCount", { n: works.length - priced })}`}
        </p>
        <p className="mt-6 max-w-[60ch] text-sm leading-relaxed opacity-60">
          {t(locale, "sale.intro")}
        </p>
      </header>

      <div className="mx-auto max-w-[1400px]">
        {works.length === 0 ? (
          <p className="py-24 text-center font-display text-[10px] uppercase tracking-widest opacity-30">
            {t(locale, "sale.empty")}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-10 py-10 sm:grid-cols-3 lg:grid-cols-4">
            {works.map((work) => (
              <Listing key={work.ref} work={work} locale={locale} />
            ))}
          </ul>
        )}
      </div>

      <div className="mx-auto max-w-[1400px] border-t border-black/10 pt-8">
        <Link
          href="/contact"
          className="font-display text-[10px] uppercase tracking-widest opacity-50 transition-opacity hover:opacity-100"
        >
          {t(locale, "sale.enquire")}
        </Link>
      </div>
    </main>
  );
}
