import Link from "next/link";
import { listPages } from "@/lib/inventory/pages";
import NewPageButton from "@/components/inventory/NewPageButton";

export const dynamic = "force-dynamic";

export const metadata = { title: "Contenido del sitio · Inventario" };

export default async function PagesIndex() {
  const pages = listPages();
  const published = pages.filter((p) => p.status === "published").length;

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <h1 className="font-serif text-3xl leading-none">Contenido del sitio</h1>
          <p className="mt-1.5 max-w-[70ch] text-sm text-neutral-600">
            Las páginas editoriales del sitio público — texto, imágenes y galerías. Las obras,
            artistas y portafolios se editan desde el inventario.
          </p>
        </div>
        <NewPageButton />
      </div>

      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {pages.length} página{pages.length === 1 ? "" : "s"} · {published} publicada
        {published === 1 ? "" : "s"}
      </p>

      {pages.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 px-4 py-12 text-center text-sm text-neutral-600">
          Todavía no hay páginas. Crea la primera para empezar a editar el sitio.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded border border-neutral-200 bg-white">
          {pages.map((page) => (
            <li key={page.slug}>
              <Link
                href={`/admin/content/${page.slug}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-neutral-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-neutral-900">{page.title}</span>
                  <span className="block truncate font-mono text-xs text-neutral-500">
                    /{page.slug}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-neutral-500">
                  {page.blocks.length} bloque{page.blocks.length === 1 ? "" : "s"}
                </span>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${
                    page.status === "published"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : "border-neutral-300 bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {page.status === "published" ? "Publicada" : "Borrador"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
