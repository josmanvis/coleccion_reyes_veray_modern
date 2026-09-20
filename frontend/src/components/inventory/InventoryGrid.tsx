import Link from "next/link";
import Image from "next/image";
import { artistName, formatMoney, titleCase } from "@/lib/inventory/fields";
import type { ArtworkRow } from "@/lib/inventory/db";
import { StatusPill } from "./InventoryTable";

export default function InventoryGrid({ rows }: { rows: ArtworkRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-5 py-16 text-center text-sm text-neutral-500">
        Ninguna obra coincide con estos filtros.
      </p>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-5 px-5 py-6 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
      {rows.map((row) => (
        <Link key={row.ref} href={`/inventory/${row.ref}`} className="group block">
          <div className="relative aspect-square overflow-hidden rounded-sm bg-neutral-100">
            {row.image_thumb ? (
              <Image
                src={row.image_thumb}
                alt={String(row.title ?? "")}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
                unoptimized
              />
            ) : (
              <span className="flex size-full items-center justify-center text-xs text-neutral-500">
                sin imagen
              </span>
            )}
            <span className="absolute left-1.5 top-1.5 rounded bg-white/85 px-1.5 py-0.5 font-mono text-[11px] text-neutral-700">
              {row.registro}
            </span>
          </div>
          <p className="mt-2 line-clamp-1 text-sm">
            {row.title ? titleCase(String(row.title)) : "Sin título"}
          </p>
          <p className="line-clamp-1 text-xs text-neutral-600">{artistName(row)}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <StatusPill group={row.status_group} />
            <span className="text-xs tabular-nums text-neutral-600">{formatMoney(row.current_value)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
