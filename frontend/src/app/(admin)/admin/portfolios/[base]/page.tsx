import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPortfolio } from "@/lib/inventory/public";
import { artistName, titleCase } from "@/lib/inventory/fields";
import { BTN, CARD, MUTED } from "@/components/inventory/ui";
import QuickEdit from "@/components/inventory/QuickEdit";
import { QUICK_EDIT_KEYS } from "@/lib/inventory/fields";
import { ArrowLeft, Pencil } from "lucide-react";
import type { ArtworkRow } from "@/lib/inventory/db";
import { getTr } from "@/lib/i18n-server";
import { artworkCtx } from "@/components/inventory/context-data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ base: string }> };

export async function generateMetadata({ params }: Props) {
  const { base } = await params;
  const portfolio = getPortfolio(decodeURIComponent(base));
  const tr = await getTr();
  return { title: portfolio ? `${portfolio.title} · ${tr("Portafolios")}` : tr("Portafolio") };
}

function quickValues(row: ArtworkRow): Record<string, string> {
  return Object.fromEntries(
    QUICK_EDIT_KEYS.map((key) => [key, row[key] === null || row[key] === undefined ? "" : String(row[key])])
  );
}

export default async function AdminPortfolio({ params }: Props) {
  const tr = await getTr();
  const { base } = await params;
  const portfolio = getPortfolio(decodeURIComponent(base));
  if (!portfolio) notFound();

  return (
    <>
      <div className="border-b border-[var(--stroke-soft)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center gap-3 px-6 py-3">
          <div className="min-w-0">
            <Link
              href="/admin/portfolios"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--ink-3)] transition hover:text-[var(--ink-1)]"
            >
              <ArrowLeft size={15} strokeWidth={1.75} aria-hidden />
              
              {tr("Portafolios")}
            </Link>
            <h1 className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--ink-1)]">
              {portfolio.title}
            </h1>
            <p className={`mt-0.5 text-sm ${MUTED}`}>
              {tr("CRV {base} · {n} hojas", { base: portfolio.base, n: portfolio.members.length })}
            </p>
          </div>

          {portfolio.parent && (
            <Link href={`/admin/artwork/${portfolio.parent.ref}`} className={`ml-auto ${BTN}`}>
              <Pencil size={15} strokeWidth={1.75} aria-hidden />
              
              {tr("Editar ficha del portafolio")}
            </Link>
          )}
        </div>
      </div>

      <div className="px-6 py-4">
        <div className={`${CARD} divide-y divide-[var(--stroke-soft)]`}>
          {portfolio.members.map((member) => (
            <div key={String(member.ref)} className="flex items-center gap-4 px-4 py-2.5" {...artworkCtx(member)}>
              <Link
                href={`/inventory/${member.ref}`}
                className="relative size-10 shrink-0 overflow-hidden rounded-sm bg-[var(--surface-alt)] ring-1 ring-[var(--stroke-soft)]"
              >
                {member.image_thumb || member.image_full ? (
                  <Image
                    src={String(member.image_thumb || member.image_full)}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                    unoptimized
                  />
                ) : null}
              </Link>
              <Link href={`/inventory/${member.ref}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm text-[var(--ink-1)]">
                  {member.title ? titleCase(String(member.title)) : tr("Sin título")}
                </span>
                <span className={`block truncate text-xs ${MUTED}`}>
                  {member.registro} · {artistName(member)}
                </span>
              </Link>
              <span className={`hidden shrink-0 text-xs sm:block ${MUTED}`}>{member.dimensions ?? ""}</span>
              <QuickEdit
                refId={String(member.ref)}
                registro={String(member.registro)}
                title={member.title ? titleCase(String(member.title)) : tr("Sin título")}
                values={quickValues(member)}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
