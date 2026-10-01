import Link from "next/link";
import { hrefWith, type SearchParams } from "./query";
import { getTr } from "@/lib/i18n-server";

export default async function Pagination({
  page,
  pages,
  total,
  params,
}: {
  page: number;
  pages: number;
  total: number;
  params: SearchParams;
}) {
  const tr = await getTr();
  if (total === 0) return null;

  const windowStart = Math.max(1, Math.min(page - 2, pages - 4));
  const windowEnd = Math.min(pages, windowStart + 4);
  const numbers = [];
  for (let n = windowStart; n <= windowEnd; n++) numbers.push(n);

  const linkClass = "rounded border border-[var(--stroke)] px-3 py-1.5 transition hover:bg-[var(--hover)]";

  return (
    <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-6 text-sm">
      <p className="text-[var(--ink-3)]">
        {tr("Página {page} de {pages}", { page, pages })}
      </p>
      <div className="flex items-center gap-1.5">
        {page > 1 && (
          <Link href={hrefWith("/inventory", params, { page: page - 1 })} className={linkClass}>
            
            {tr("Anterior")}
          </Link>
        )}
        {numbers.map((n) => (
          <Link
            key={n}
            href={hrefWith("/inventory", params, { page: n === 1 ? undefined : n })}
            className={
              n === page
                ? "rounded bg-[var(--brand)] px-3 py-1.5 text-white"
                : `${linkClass} text-[var(--ink-2)]`
            }
          >
            {n}
          </Link>
        ))}
        {page < pages && (
          <Link href={hrefWith("/inventory", params, { page: page + 1 })} className={linkClass}>
            
            {tr("Siguiente")}
          </Link>
        )}
      </div>
    </div>
  );
}
