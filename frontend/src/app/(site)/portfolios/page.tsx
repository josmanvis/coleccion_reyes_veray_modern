import Link from "next/link";
import Image from "next/image";
import { listPortfolios } from "@/lib/inventory/public";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const revalidate = 3600;

export const metadata = {
  title: "Portfolios | Colección Reyes-Veray",
  description:
    "Portfolios and suites held in the Colección Reyes-Veray, each filed under a shared registro number.",
};

export default async function PortfoliosIndex() {
  const locale = await getLocale();
  const portfolios = listPortfolios();
  const sheets = portfolios.reduce((sum, p) => sum + p.members.length, 0);

  return (
    <main className="min-h-screen bg-neutral-100 px-6 pb-24 pt-32 md:px-12">
      <header className="mx-auto max-w-[1400px] border-b border-black/10 pb-8">
        <h1 className="font-serif text-4xl leading-none md:text-6xl">{t(locale, "portfolios.title")}</h1>
        <p className="mt-3 font-display text-[10px] uppercase tracking-widest opacity-40">
          {t(locale, "portfolios.count", { n: portfolios.length, m: sheets })}
        </p>
        <p className="mt-4 max-w-[70ch] text-sm leading-relaxed opacity-60">
          Works filed as <span className="font-mono">0012.a</span>,{" "}
          <span className="font-mono">0012.b</span> and so on belong to one portfolio, kept together
          here under its shared registro number.
        </p>
      </header>

      <ul className="mx-auto mt-10 grid max-w-[1400px] grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {portfolios.map((portfolio) => {
          const cover =
            portfolio.parent?.image_thumb ||
            portfolio.members.find((m) => m.image_thumb)?.image_thumb ||
            null;

          return (
            <li key={portfolio.base}>
              <Link href={`/${portfolio.slug}`} className="group block">
                <div className="relative aspect-[4/3] overflow-hidden bg-black/[0.04]">
                  {cover ? (
                    <Image
                      src={String(cover)}
                      alt={portfolio.title}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                      unoptimized
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center font-display text-[10px] uppercase tracking-widest opacity-20">
                      Sin imagen
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm transition-opacity group-hover:opacity-50">
                  {portfolio.title}
                </p>
                <p className="font-display text-[10px] uppercase tracking-widest opacity-30">
                  {portfolio.members.length} sheets · #{portfolio.base}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
