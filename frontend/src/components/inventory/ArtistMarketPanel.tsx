"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flame, Plus, Trash2 } from "lucide-react";
import {
  SALE_SOURCE_LABELS,
  WORK_KIND_LABELS,
  pct,
  type Comparable,
  type HotStatus,
  type ValuationRules,
  type WorkKind,
} from "@/lib/inventory/valuation-rules";
import { BADGE, BTN, BTN_PRIMARY, CARD, FIELD, LABEL, MUTED } from "./ui";
import { useToast } from "./ToastProvider";
import { useTr } from "@/components/I18nProvider";

export type ArtistMarketData = {
  key: string;
  name: string;
  hotSetting: "auto" | "si" | "no";
  hot: HotStatus;
  deathYear: number | null;
  sales: Comparable[];
  rules: ValuationRules;
  /** ISO date the page was rendered, so "recent" is the same on server and client. */
  today: string;
};

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const SOURCE_COLOR: Record<Comparable["source"], string> = {
  mercado: "var(--brand)",
  compra: "var(--ink-3)",
  venta: "var(--success)",
};

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/market", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo guardar");
  return data;
}

/** Sales history, the hot-commodity call and the form for recording auction or gallery results. */
export default function ArtistMarketPanel({ market }: { market: ArtistMarketData }) {
  const tr = useTr();
  const router = useRouter();
  const { notify } = useToast();
  const [pending, setPending] = useState(false);
  const empty = { sale_date: "", price: "", kind: "unica" as WorkKind, title: "", venue: "", url: "", notes: "" };
  const [form, setForm] = useState(empty);
  const { hot, rules } = market;
  const recentFrom = `${Number(market.today.slice(0, 4)) - rules.recentYears}${market.today.slice(4)}`;

  async function run(body: Record<string, unknown>, ok: string, after?: () => void) {
    setPending(true);
    try {
      await post(body);
      notify(tr(ok));
      after?.();
      router.refresh();
    } catch (error) {
      notify(tr((error as Error).message), "error");
    }
    setPending(false);
  }

  const signals = [
    {
      label: tr("Ventas de mercado en los últimos 3 años"),
      value: String(hot.marketSales3y),
      met: hot.marketSales3y >= rules.hotMinSales,
      need: tr("mínimo {n}", { n: rules.hotMinSales }),
    },
    {
      label: tr("Crecimiento anual de precios (10 años)"),
      value: hot.growth === null ? tr("sin datos suficientes") : `${hot.growth >= 0 ? "+" : ""}${pct(hot.growth)}`,
      met: hot.growth !== null && hot.growth >= rules.hotGrowth,
      need: tr("mínimo {n}", { n: pct(rules.hotGrowth) }),
    },
    {
      label: tr("Artículo en Wikipedia"),
      value: hot.famous ? tr("Sí") : tr("No"),
      met: null,
      need: tr("referencia"),
    },
    {
      label: tr("Fallecido"),
      value: market.deathYear ? String(market.deathYear) : "—",
      met: null,
      need: tr("×{n} al valor si murió después de la venta", { n: rules.deathMultiplier }),
    },
  ];

  return (
    <div className="space-y-4">
      <section className={`${CARD} p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Flame size={16} strokeWidth={1.75} className={hot.hot ? "text-[var(--danger)]" : MUTED} aria-hidden />
              {tr("¿Artista en alza?")}
              <span className={`${BADGE} ${hot.hot ? "bg-[var(--danger-soft)] text-[var(--danger)]" : ""}`}>
                {hot.hot ? tr("En alza · ×{n}", { n: rules.hotMultiplier }) : tr("No")}
              </span>
            </h2>
            <p className={`mt-1 max-w-[70ch] text-sm ${MUTED}`}>
              {tr("En automático cuenta como en alza cuando hay volumen de ventas recientes y los precios suben más rápido que lo normal. Puedes decidirlo a mano.")}
            </p>
          </div>
          <div className="inline-flex overflow-hidden rounded-[var(--radius)] border border-[var(--stroke)]">
            {(["auto", "si", "no"] as const).map((option) => (
              <button
                key={option}
                type="button"
                disabled={pending}
                onClick={() => run({ action: "set_hot", key: market.key, name: market.name, hot: option }, "Guardado")}
                className={`border-r border-[var(--stroke)] px-3 py-1.5 text-sm last:border-r-0 ${
                  market.hotSetting === option ? "bg-[var(--selected)] font-semibold" : "hover:bg-[var(--hover)]"
                }`}
              >
                {tr(option === "auto" ? "Automático" : option === "si" ? "Sí, en alza" : "No")}
              </button>
            ))}
          </div>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-4">
          {signals.map((signal) => (
            <div key={signal.label} className="rounded-[var(--radius)] border border-[var(--stroke-soft)] px-3 py-2">
              <dt className={`text-xs ${MUTED}`}>{signal.label}</dt>
              <dd className="mt-0.5 flex items-baseline gap-2">
                <span className="text-lg font-semibold tabular-nums">{signal.value}</span>
                {signal.met !== null && (
                  <span className={`text-xs ${signal.met ? "text-[var(--success)]" : MUTED}`}>
                    {signal.met ? "✓" : ""} {signal.need}
                  </span>
                )}
              </dd>
              {signal.met === null && <p className={`text-[11px] ${MUTED}`}>{signal.need}</p>}
            </div>
          ))}
        </dl>
      </section>

      <section className={`${CARD} p-4`}>
        <h2 className="text-sm font-semibold">{tr("Historial de ventas · {n}", { n: market.sales.length })}</h2>
        <p className={`mt-1 text-sm ${MUTED}`}>
          {tr("Las ventas de los últimos {n} años del mismo tipo de obra son la base del precio sugerido.", { n: rules.recentYears })}
        </p>
        {market.sales.length > 1 && <SalesChart sales={market.sales} />}
        {market.sales.length === 0 ? (
          <p className={`mt-3 text-sm ${MUTED}`}>{tr("Aún no hay ventas registradas para este artista.")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b border-[var(--stroke-soft)] text-left text-xs ${MUTED}`}>
                  <th className="py-1.5 pr-3 font-medium">{tr("Fecha")}</th>
                  <th className="py-1.5 pr-3 font-medium">{tr("Origen")}</th>
                  <th className="py-1.5 pr-3 font-medium">{tr("Tipo")}</th>
                  <th className="py-1.5 pr-3 font-medium">{tr("Obra")}</th>
                  <th className="py-1.5 pr-3 font-medium">{tr("Dónde")}</th>
                  <th className="py-1.5 pr-3 text-right font-medium">{tr("Precio")}</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--stroke-soft)]">
                {market.sales.map((sale, i) => {
                  const recent = sale.date >= recentFrom;
                  return (
                    <tr key={sale.id ?? `${sale.registro}-${sale.source}-${i}`}>
                      <td className="py-1.5 pr-3 tabular-nums">
                        {sale.date}
                        {recent && <span className="ml-1.5 text-[10px] font-semibold uppercase text-[var(--brand)]">{tr("reciente")}</span>}
                      </td>
                      <td className="py-1.5 pr-3">
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: SOURCE_COLOR[sale.source] }} />
                        {tr(SALE_SOURCE_LABELS[sale.source])}
                      </td>
                      <td className="py-1.5 pr-3">{tr(WORK_KIND_LABELS[sale.kind])}</td>
                      <td className="max-w-[240px] truncate py-1.5 pr-3">
                        {sale.registro ? (
                          <Link href={`/inventory/${encodeURIComponent(sale.registro)}`} className="hover:underline">
                            #{sale.registro} {sale.title}
                          </Link>
                        ) : (
                          sale.title || "—"
                        )}
                      </td>
                      <td className={`max-w-[200px] truncate py-1.5 pr-3 ${MUTED}`}>{sale.venue || "—"}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{money(sale.price)}</td>
                      <td className="py-1.5 text-right">
                        {sale.id !== undefined && (
                          <button
                            type="button"
                            disabled={pending}
                            aria-label={tr("Enviar a la papelera")}
                            onClick={() => run({ action: "delete_sale", id: sale.id }, "Venta enviada a la papelera")}
                            className="rounded p-1 text-[var(--ink-3)] hover:bg-[var(--hover)] hover:text-[var(--danger)]"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`${CARD} p-4`}>
        <h2 className="text-sm font-semibold">{tr("Registrar venta de mercado")}</h2>
        <p className={`mt-1 text-sm ${MUTED}`}>
          {tr("Resultados de subasta, ventas de galería o privadas de obra de este artista — no de la colección.")}
        </p>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              { action: "add_sale", artist_key: market.key, artist_name: market.name, ...form },
              "Venta registrada",
              () => setForm(empty)
            );
          }}
        >
          <label className="sm:col-span-1">
            <span className={LABEL}>{tr("Fecha")}</span>
            <input className={FIELD} placeholder="2025-11" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} required />
          </label>
          <label className="sm:col-span-1">
            <span className={LABEL}>{tr("Precio (USD)")}</span>
            <input className={FIELD} inputMode="decimal" placeholder="12000" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
          </label>
          <label className="sm:col-span-1">
            <span className={LABEL}>{tr("Tipo")}</span>
            <select className={FIELD} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as WorkKind })}>
              <option value="unica">{tr(WORK_KIND_LABELS.unica)}</option>
              <option value="edicion">{tr(WORK_KIND_LABELS.edicion)}</option>
            </select>
          </label>
          <label className="sm:col-span-3">
            <span className={LABEL}>{tr("Obra")}</span>
            <input className={FIELD} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label className="sm:col-span-2">
            <span className={LABEL}>{tr("Dónde (subasta, galería)")}</span>
            <input className={FIELD} value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          </label>
          <label className="sm:col-span-2">
            <span className={LABEL}>{tr("Enlace")}</span>
            <input className={FIELD} type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </label>
          <label className="sm:col-span-2">
            <span className={LABEL}>{tr("Notas")}</span>
            <input className={FIELD} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <div className="sm:col-span-6">
            <button type="submit" disabled={pending} className={BTN_PRIMARY}>
              <Plus size={15} /> {tr("Registrar venta")}
            </button>
            <button type="button" disabled={pending} onClick={() => setForm(empty)} className={`${BTN} ml-2`}>
              {tr("Limpiar")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/** Every sale on a log price axis over time, coloured by where it came from. */
function SalesChart({ sales }: { sales: Comparable[] }) {
  const tr = useTr();
  const W = 720;
  const H = 180;
  const P = { l: 56, r: 12, t: 10, b: 24 };
  const points = sales.map((s) => {
    const [y, m] = s.date.split("-").map(Number);
    return { ...s, t: y + ((m || 7) - 1) / 12 };
  });
  const t0 = Math.floor(Math.min(...points.map((p) => p.t)));
  const t1 = Math.max(Math.ceil(Math.max(...points.map((p) => p.t))), t0 + 1);
  // Log scale, padded so points never sit on the frame.
  const lo = Math.log10(Math.min(...points.map((p) => p.price))) - 0.15;
  const hi = Math.max(Math.log10(Math.max(...points.map((p) => p.price))), lo + 0.7) + 0.15;
  const x = (t: number) => P.l + ((t - t0) / (t1 - t0)) * (W - P.l - P.r);
  const y = (price: number) => H - P.b - ((Math.log10(price) - lo) / (hi - lo)) * (H - P.t - P.b);
  // 1-2-5 gridlines while the range is under three decades, powers of ten beyond that.
  const steps = hi - lo < 3 ? [1, 2, 5] : [1];
  const ticks = Array.from({ length: Math.ceil(hi) - Math.floor(lo) + 1 }, (_, i) => Math.floor(lo) + i)
    .flatMap((exp) => steps.map((m) => m * 10 ** exp))
    .filter((v) => Math.log10(v) >= lo && Math.log10(v) <= hi);
  const years = Array.from({ length: t1 - t0 + 1 }, (_, i) => t0 + i).filter((_, i, all) => all.length <= 12 || i % Math.ceil(all.length / 12) === 0);

  return (
    <figure className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={tr("Precios de venta en el tiempo")}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--stroke-soft)" />
            <text x={P.l - 6} y={y(v)} textAnchor="end" dominantBaseline="central" fontSize={10} fill="var(--ink-3)">
              {money(v)}
            </text>
          </g>
        ))}
        {years.map((year) => (
          <text key={year} x={x(year)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--ink-3)">
            {year}
          </text>
        ))}
        {points.map((p, i) => (
          <circle key={i} cx={x(p.t)} cy={y(p.price)} r={4} fill={SOURCE_COLOR[p.source]} fillOpacity={0.75}>
            <title>{`${p.date} · ${money(p.price)} · ${tr(SALE_SOURCE_LABELS[p.source])}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className={`mt-1 flex flex-wrap gap-4 text-xs ${MUTED}`}>
        {(Object.keys(SOURCE_COLOR) as Array<Comparable["source"]>).map((source) => (
          <span key={source} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: SOURCE_COLOR[source] }} />
            {tr(SALE_SOURCE_LABELS[source])}
          </span>
        ))}
        <span>{tr("escala logarítmica")}</span>
      </figcaption>
    </figure>
  );
}
