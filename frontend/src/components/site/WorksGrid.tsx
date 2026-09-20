import Link from "next/link";
import Image from "next/image";
import type { ArtworkRow } from "@/lib/inventory/db";
import { sentenceCase } from "@/lib/inventory/fields";

/**
 * A work only has a public page if it carries the slug the original site
 * published it under; the rest still show in the grid, just not as links.
 */
export function artworkHref(row: ArtworkRow): string | null {
  return row.website_slug ? `/art/${row.website_slug}` : null;
}

function Tile({ row }: { row: ArtworkRow }) {
  const image = row.image_thumb || row.image_full;
  const title = row.title ? sentenceCase(String(row.title)) : "Untitled";

  return (
    <figure className="group">
      <div className="relative aspect-square overflow-hidden bg-black/[0.04]">
        {image ? (
          <Image
            src={String(image)}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-contain transition-transform duration-500 group-hover:scale-[1.03]"
            unoptimized
          />
        ) : (
          <span className="flex size-full items-center justify-center font-display text-[10px] uppercase tracking-widest opacity-20">
            Sin imagen
          </span>
        )}
      </div>
      <figcaption className="mt-2">
        <p className="truncate text-sm">{title}</p>
        <p className="font-display text-[10px] tracking-widest opacity-30">
          {row.year ? `${row.year} · ` : ""}CRV #{row.registro}
        </p>
      </figcaption>
    </figure>
  );
}

export default function WorksGrid({ rows }: { rows: ArtworkRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-16 text-center font-display text-[10px] uppercase tracking-widest opacity-30">
        No works on file
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map((row) => {
        const href = artworkHref(row);
        return (
          <li key={String(row.ref)}>
            {href ? (
              <Link href={href}>
                <Tile row={row} />
              </Link>
            ) : (
              <Tile row={row} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
