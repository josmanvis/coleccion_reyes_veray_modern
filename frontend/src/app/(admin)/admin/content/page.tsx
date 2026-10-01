import Link from "next/link";
import { listPages } from "@/lib/inventory/pages";
import NewPageButton from "@/components/inventory/NewPageButton";
import { getTr } from "@/lib/i18n-server";
import { PUBLIC_SITE_ENABLED } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const tr = await getTr();
  return { title: tr("Contenido del sitio · Inventario") };
}

export default async function PagesIndex() {
  const tr = await getTr();
  const pages = listPages();
  const published = pages.filter((p) => p.status === "published").length;

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <h1 className="text-3xl leading-none">{tr("Contenido del sitio")}</h1>
          <p className="mt-1.5 max-w-[70ch] text-sm text-[var(--ink-3)]">
            
            {tr("Las páginas editoriales del sitio público — texto, imágenes y galerías. Las obras, artistas y portafolios se editan desde el inventario.")}
          </p>
        </div>
        <NewPageButton />
      </div>

      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">
        {tr(pages.length === 1 ? "{n} página" : "{n} páginas", { n: pages.length })} ·{" "}
        {tr(published === 1 ? "{n} publicada" : "{n} publicadas", { n: published })}
      </p>

      {pages.length === 0 ? (
        <p className="rounded border border-dashed border-[var(--stroke)] px-4 py-12 text-center text-sm text-[var(--ink-3)]">
          
          {tr("Todavía no hay páginas. Crea la primera para empezar a editar el sitio.")}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--stroke-soft)] rounded border border-[var(--stroke-soft)] bg-[var(--surface)]">
          {pages.map((page) => (
            <li key={page.slug}>
              <Link
                href={`/admin/content/${page.slug}`}
                data-ctx="page"
                data-slug={page.slug}
                {...(PUBLIC_SITE_ENABLED && page.status === "published" ? { "data-public-href": `/${page.slug}` } : {})}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-[var(--surface-alt)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-[var(--ink-1)]">{page.title}</span>
                  <span className="block truncate font-mono text-xs text-[var(--ink-3)]">
                    /{page.slug}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-[var(--ink-3)]">
                  {tr(page.blocks.length === 1 ? "{n} bloque" : "{n} bloques", { n: page.blocks.length })}
                </span>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${
                    page.status === "published"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : "border-[var(--stroke)] bg-[var(--hover)] text-[var(--ink-2)]"
                  }`}
                >
                  {page.status === "published" ? tr("Publicada") : tr("Borrador")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
