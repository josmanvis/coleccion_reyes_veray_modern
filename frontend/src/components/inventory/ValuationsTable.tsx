"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Flame, Search } from "lucide-react";
import type { WorkKind } from "@/lib/inventory/valuation-rules";
import { normalizeText } from "@/lib/inventory/fields";
import { BTN, CARD, FIELD, MUTED } from "./ui";
import { useTr } from "@/components/I18nProvider";

export type ValuationRow = {
  ref: number;
  registro: string;
  title: string | null;
  artist: string;
  artistSlug: string | null;
  kind: WorkKind;
  recorded: number | null;
  purchase: number | null;
  suggested: number | null;
  basis: "mercado" | "compra" | "valor" | null;
  confidence: "alta" | "media" | "baja" | null;
  inCollection: boolean;
  hot: boolean;
};

type SortKey = "registro" | "artist" | "recorded" | "suggested" | "diff";

const BASIS_LABELS = { mercado: "Ventas recientes", compra: "Precio de compra", valor: "Valor registrado" } as const;

const money = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const diffOf = (row: ValuationRow) => (row.suggested && row.recorded ? row.suggested / row.recorded - 1 : null);

const PAGE = 200;

export default function ValuationsTable({ rows }: { rows: ValuationRow[] }) {
  const tr = useTr();
  const [query, setQuery] = useState("");
  const [basis, setBasis] = useState<"" | NonNullable<ValuationRow["basis"]> | "ninguna">("");
  const [onlyCollection, setOnlyCollection] = useState(true);
  const [onlyHot, setOnlyHot] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "suggested", dir: -1 });
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const needle = normalizeText(query);
    const list = rows.filter(
      (row) =>
        (!onlyCollection || row.inCollection) &&
        (!onlyHot || row.hot) &&
        (basis === "" || (basis === "ninguna" ? row.basis === null : row.basis === basis)) &&
        (!needle || normalizeText(`${row.registro} ${row.title ?? ""} ${row.artist}`).includes(needle))
    );
    const value = (row: ValuationRow): number | string | null =>
      sort.key === "diff" ? diffOf(row) : sort.key === "registro" ? row.registro : sort.key === "artist" ? row.artist : row[sort.key];
    return list.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === null) return vb === null ? 0 : 1;
      if (vb === null) return -1;
      return (typeof va === "string" ? va.localeCompare(String(vb)) : va - Number(vb)) * sort.dir;
    });
  }, [rows, query, basis, onlyCollection, onlyHot, sort]);

  const totals = filtered.reduce(
    (sum, row) => ({
      recorded: sum.recorded + (row.recorded ?? 0),
      suggested: sum.suggested + (row.suggested ?? 0),
      priced: sum.priced + (row.suggested !== null ? 1 : 0),
    }),
    { recorded: 0, suggested: 0, priced: 0 }
  );

  function exportCsv() {
    const header = ["registro", "artista", "titulo", "tipo", "valor_registrado", "precio_compra", "precio_sugerido", "diferencia_%", "base", "confianza", "en_alza"];
    const cell = (v: unknown) => {
      const text = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = filtered.map((row) => {
      const diff = diffOf(row);
      return [row.registro, row.artist, row.title, row.kind, row.recorded, row.purchase, row.suggested, diff === null ? "" : Math.round(diff * 100), row.basis, row.confidence, row.hot ? "si" : ""]
        .map(cell)
        .join(",");
    });
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `valoraciones-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function header(key: SortKey, label: string, align: "left" | "right" = "left") {
    const active = sort.key === key;
    const Icon = sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <th className={`py-2 pr-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
        <button
          type="button"
          onClick={() => setSort(active ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: key === "registro" || key === "artist" ? 1 : -1 })}
          className={`inline-flex items-center gap-1 hover:text-[var(--ink-1)] ${active ? "text-[var(--ink-1)]" : ""}`}
        >
          {tr(label)}
          {active && <Icon size={12} />}
        </button>
      </th>
    );
  }

  const totalDiff = totals.recorded ? totals.suggested / totals.recorded - 1 : null;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-4">
        {[
          { label: tr("Obras"), value: filtered.length.toLocaleString("en-US") },
          { label: tr("Con precio sugerido"), value: totals.priced.toLocaleString("en-US") },
          { label: tr("Valor registrado"), value: money(totals.recorded) },
          {
            label: tr("Valor sugerido"),
            value: money(totals.suggested),
            extra: totalDiff === null ? null : `${totalDiff > 0 ? "+" : ""}${Math.round(totalDiff * 100)}%`,
          },
        ].map((stat) => (
          <div key={stat.label} className={`${CARD} px-4 py-3`}>
            <p className={`text-xs font-medium uppercase tracking-wide ${MUTED}`}>{stat.label}</p>
            <p className="mt-1 text-lg font-semibold leading-none tabular-nums">
              {stat.value}
              {"extra" in stat && stat.extra && <span className={`ml-2 text-sm font-normal ${MUTED}`}>{stat.extra}</span>}
            </p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-4)]" />
          <input
            className={`${FIELD} pl-8`}
            placeholder={tr("Buscar por registro, título o artista…")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
          />
        </label>
        <select className={`${FIELD} w-auto`} value={basis} onChange={(e) => setBasis(e.target.value as typeof basis)}>
          <option value="">{tr("Cualquier base")}</option>
          <option value="mercado">{tr(BASIS_LABELS.mercado)}</option>
          <option value="compra">{tr(BASIS_LABELS.compra)}</option>
          <option value="valor">{tr(BASIS_LABELS.valor)}</option>
          <option value="ninguna">{tr("Sin base para sugerir")}</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyCollection} onChange={(e) => setOnlyCollection(e.target.checked)} />
          {tr("Solo en la colección")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyHot} onChange={(e) => setOnlyHot(e.target.checked)} />
          {tr("Solo artistas en alza")}
        </label>
        <button type="button" onClick={exportCsv} className={BTN}>
          <Download size={15} /> CSV
        </button>
      </div>

      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b border-[var(--stroke-soft)] text-xs ${MUTED}`}>
              <th className="w-3 pl-3" />
              {header("registro", "Registro")}
              {header("artist", "Artista")}
              <th className="py-2 pr-3 text-left font-medium">{tr("Título")}</th>
              {header("recorded", "Valor registrado", "right")}
              {header("suggested", "Sugerido", "right")}
              {header("diff", "Diferencia", "right")}
              <th className="py-2 pr-3 text-left font-medium">{tr("Base")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--stroke-soft)]">
            {filtered.slice(0, limit).map((row) => {
              const diff = diffOf(row);
              return (
                <tr key={row.ref} className="hover:bg-[var(--hover)]">
                  <td className="pl-3">{row.hot && <Flame size={13} className="text-[var(--danger)]" aria-label={tr("En alza")} />}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">
                    <Link href={`/inventory/${encodeURIComponent(String(row.ref))}`} className="hover:underline">
                      {row.registro}
                    </Link>
                  </td>
                  <td className="max-w-[200px] truncate py-1.5 pr-3">
                    {row.artistSlug ? (
                      <Link href={`/admin/artists/${row.artistSlug}?tab=mercado`} className="hover:underline">
                        {row.artist}
                      </Link>
                    ) : (
                      row.artist
                    )}
                  </td>
                  <td className={`max-w-[280px] truncate py-1.5 pr-3 ${MUTED}`}>{row.title || tr("Sin título")}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{money(row.recorded)}</td>
                  <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">{money(row.suggested)}</td>
                  <td
                    className={`py-1.5 pr-3 text-right tabular-nums ${
                      diff === null ? MUTED : diff > 0.005 ? "text-[var(--success)]" : diff < -0.005 ? "text-[var(--danger)]" : MUTED
                    }`}
                  >
                    {diff === null ? "—" : `${diff > 0 ? "+" : ""}${Math.round(diff * 100)}%`}
                  </td>
                  <td className={`py-1.5 pr-3 text-xs ${MUTED}`}>
                    {row.basis ? tr(BASIS_LABELS[row.basis]) : "—"}
                    {row.confidence && <span className="ml-1">· {tr(row.confidence)}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > limit && (
          <div className="border-t border-[var(--stroke-soft)] p-3 text-center">
            <button type="button" className={BTN} onClick={() => setLimit((n) => n + PAGE)}>
              {tr("Ver más ({n})", { n: filtered.length - limit })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
