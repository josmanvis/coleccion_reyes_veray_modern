/**
 * Suggested market price for a work, from the collection's pricing rules:
 *
 *   1. Start from the market — the artist's recent sales of the same kind of
 *      work (unique piece vs. edition). Without recent sales, start from what
 *      the collection paid for this work.
 *   2. Grow that price 8% a year (compounded) from the date of the sale.
 *   3. If the artist died after that sale, double it.
 *   4. If the artist's work has become a hot commodity, apply the hot premium.
 *
 * Every number is a setting, and the result carries each step so the screen
 * can show how it was reached. DB-free and pure, so client components and
 * scripts can use it.
 */

export type ValuationRules = {
  /** Yearly appreciation, e.g. 0.08. */
  annualRate: number;
  /** Applied once when the artist died after the reference sale. */
  deathMultiplier: number;
  /** Applied when the artist counts as a hot commodity. */
  hotMultiplier: number;
  /** Sales older than this many years are history, not the current market. */
  recentYears: number;
  /** Auto "hot": at least this many market sales in the last 3 years… */
  hotMinSales: number;
  /** …and prices climbing at least this fast per year (e.g. 0.15). */
  hotGrowth: number;
};

export const DEFAULT_RULES: ValuationRules = {
  annualRate: 0.08,
  deathMultiplier: 2,
  hotMultiplier: 1.5,
  recentYears: 5,
  hotMinSales: 3,
  hotGrowth: 0.15,
};

/** Unique piece, or one of an edition (prints, photographs, multiples). */
export type WorkKind = "unica" | "edicion";

export const WORK_KIND_LABELS: Record<WorkKind, string> = { unica: "Obra única", edicion: "Edición / gráfica" };

export type SaleSource = "mercado" | "compra" | "venta";

export const SALE_SOURCE_LABELS: Record<SaleSource, string> = {
  mercado: "Venta de mercado",
  compra: "Compra de la colección",
  venta: "Venta de la colección",
};

export type Comparable = {
  price: number;
  /** ISO date, possibly partial ("2012", "2012-04"). */
  date: string;
  kind: WorkKind;
  source: SaleSource;
  /** Where it sold: auction house, gallery, buyer. */
  venue: string;
  title?: string | null;
  /** The collection work it refers to, for purchases and sales. */
  registro?: string | null;
  id?: number;
};

export type HotStatus = {
  hot: boolean;
  /** "manual" when someone set it on the artist; "auto" when the signals did. */
  by: "manual" | "auto" | null;
  marketSales3y: number;
  /** Yearly price growth seen in the artist's sales, when there is enough data. */
  growth: number | null;
  famous: boolean;
};

/** `label` and notes are Spanish templates with {placeholders}, filled from `vars` (so they can be translated). */
export type Step = { label: string; vars?: Record<string, string | number>; detail?: string; value: number };

export type Note = { text: string; vars?: Record<string, string | number> };

export type Valuation = {
  suggested: number | null;
  basis: "mercado" | "compra" | "valor" | null;
  confidence: "alta" | "media" | "baja" | null;
  steps: Step[];
  /** The sales the market step used. */
  used: Comparable[];
  notes: Note[];
};

const MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

/**
 * Reads the spreadsheet's dates: "8/noviembre/2013", "12/sept./2008",
 * "mayo/2012", "octubre 2021", "2016", "1991 c.", and ISO dates.
 */
export function parseLooseDate(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return null;
  const iso = text.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (iso) return [iso[1], iso[2], iso[3]].filter(Boolean).join("-");
  const year = text.match(/\b(1[89]\d{2}|20\d{2})\b/)?.[1];
  if (!year) return null;
  const month = Object.entries(MONTHS).find(([prefix]) =>
    new RegExp(`(^|[^a-z])${prefix}`).test(text.normalize("NFD").replace(/\p{M}/gu, ""))
  )?.[1];
  if (!month) return year;
  const day = text.match(/^(\d{1,2})\s*[/\-\s]/)?.[1];
  return [year, String(month).padStart(2, "0"), day?.padStart(2, "0")].filter(Boolean).join("-");
}

/** Years between a partial ISO date and `today`, as a fraction. Partial dates sit mid-period. */
export function yearsSince(date: string, today: Date): number {
  const [y, m, d] = date.split("-").map(Number);
  const when = new Date(Date.UTC(y, m ? m - 1 : 6, d || (m ? 15 : 1)));
  return Math.max(0, (today.getTime() - when.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function yearOf(date: string | null): number | null {
  const year = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isFinite(year) && year > 1000 ? year : null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round = (value: number) => (value >= 1000 ? Math.round(value / 50) * 50 : Math.round(value / 5) * 5);

/** Yearly growth across an artist's sales: least-squares slope of log(price) on time. */
export function priceGrowth(sales: Comparable[], today: Date): number | null {
  const points = sales.filter((s) => s.price > 0).map((s) => ({ t: -yearsSince(s.date, today), p: Math.log(s.price) }));
  if (points.length < 3) return null;
  const span = Math.max(...points.map((p) => p.t)) - Math.min(...points.map((p) => p.t));
  if (span < 2) return null;
  const mt = points.reduce((s, p) => s + p.t, 0) / points.length;
  const mp = points.reduce((s, p) => s + p.p, 0) / points.length;
  const num = points.reduce((s, p) => s + (p.t - mt) * (p.p - mp), 0);
  const den = points.reduce((s, p) => s + (p.t - mt) ** 2, 0);
  return den ? Math.exp(num / den) - 1 : null;
}

/** Hot commodity: set by hand on the artist, or recent volume *and* rising prices. */
export function hotStatus(
  sales: Comparable[],
  manual: "auto" | "si" | "no",
  famous: boolean,
  rules: ValuationRules,
  today: Date
): HotStatus {
  const market = sales.filter((s) => s.source === "mercado");
  const marketSales3y = market.filter((s) => yearsSince(s.date, today) <= 3).length;
  const growth = priceGrowth(sales.filter((s) => yearsSince(s.date, today) <= 10), today);
  if (manual !== "auto") return { hot: manual === "si", by: "manual", marketSales3y, growth, famous };
  const hot = marketSales3y >= rules.hotMinSales && growth !== null && growth >= rules.hotGrowth;
  return { hot, by: hot ? "auto" : null, marketSales3y, growth, famous };
}

/** Rolls one sale forward to today: yearly growth, then the death multiplier if it applies. */
function rollForward(price: number, date: string, deathYear: number | null, rules: ValuationRules, today: Date) {
  const years = yearsSince(date, today);
  const grown = price * (1 + rules.annualRate) ** years;
  const saleYear = yearOf(date);
  const deathApplies = deathYear !== null && saleYear !== null && deathYear >= saleYear;
  return { years, grown, deathApplies, value: deathApplies ? grown * rules.deathMultiplier : grown };
}

export const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

export function valuate(input: {
  work: {
    registro: string;
    kind: WorkKind;
    purchasePrice: number | null;
    acquisitionDate: string | null;
    currentValue: number | null;
  };
  /** Every known sale of the artist's work, this one included. */
  sales: Comparable[];
  deathYear: number | null;
  hot: HotStatus;
  rules: ValuationRules;
  today?: Date;
}): Valuation {
  const { work, sales, deathYear, hot, rules } = input;
  const today = input.today ?? new Date();
  const steps: Step[] = [];
  const notes: Note[] = [];
  let used: Comparable[] = [];
  let basis: Valuation["basis"] = null;
  let value: number | null = null;

  const recent = sales.filter((s) => s.price > 0 && yearsSince(s.date, today) <= rules.recentYears);
  const sameKind = recent.filter((s) => s.kind === work.kind);

  if (sameKind.length > 0) {
    // 1. The market: each recent sale rolled forward to today, then the median.
    basis = "mercado";
    used = sameKind;
    const rolled = sameKind.map((s) => rollForward(s.price, s.date, deathYear, rules, today).value);
    const raw = median(sameKind.map((s) => s.price));
    steps.push({
      label: "Mediana de {n} venta(s) reciente(s) del artista",
      vars: { n: sameKind.length },
      value: raw,
    });
    value = median(rolled);
    const beforeDeath = deathYear !== null && sameKind.some((s) => (yearOf(s.date) ?? 9999) <= deathYear);
    steps.push({
      label: beforeDeath
        ? "+{rate} anual desde cada venta, ×{death} las anteriores a su muerte ({year})"
        : "+{rate} anual desde cada venta",
      vars: { rate: pct(rules.annualRate), death: rules.deathMultiplier, year: deathYear ?? "" },
      value,
    });
    if (recent.length > sameKind.length) {
      notes.push({ text: "Se ignoraron {n} venta(s) de otro tipo de obra.", vars: { n: recent.length - sameKind.length } });
    }
  } else {
    if (recent.length > 0) notes.push({ text: "Hay ventas recientes del artista, pero de otro tipo de obra." });
    const purchaseDate = parseLooseDate(work.acquisitionDate);
    if (work.purchasePrice && work.purchasePrice > 0 && purchaseDate) {
      // Fallback: what the collection paid, rolled forward.
      basis = "compra";
      const roll = rollForward(work.purchasePrice, purchaseDate, deathYear, rules, today);
      steps.push({ label: "Precio de compra", detail: purchaseDate, value: work.purchasePrice });
      steps.push({
        label: "+{rate} anual × {years} años",
        vars: { rate: pct(rules.annualRate), years: roll.years.toFixed(1) },
        value: roll.grown,
      });
      if (roll.deathApplies) {
        steps.push({
          label: "Artista fallecido ({year}) ×{death}",
          vars: { year: deathYear!, death: rules.deathMultiplier },
          value: roll.value,
        });
      } else if (deathYear !== null) {
        notes.push({ text: "Comprada después de la muerte del artista ({year}); no se duplica.", vars: { year: deathYear } });
      }
      value = roll.value;
    } else if (work.currentValue && work.currentValue > 0) {
      // Last resort: the recorded value, whose date is unknown — no growth.
      basis = "valor";
      steps.push({ label: "Valor registrado (sin fecha)", value: work.currentValue });
      value = work.currentValue;
      notes.push({ text: "Sin ventas recientes ni compra fechada: se parte del valor registrado, sin crecimiento." });
    } else {
      notes.push({ text: "Sin ventas, compra con precio ni valor registrado: no hay base para sugerir." });
    }
  }

  if (value !== null && hot.hot) {
    value *= rules.hotMultiplier;
    steps.push({
      label: hot.by === "manual" ? "Artista en alza ×{hot} (marcado a mano)" : "Artista en alza ×{hot} ({n} ventas en 3 años, +{growth} anual)",
      vars: { hot: rules.hotMultiplier, n: hot.marketSales3y, growth: pct(hot.growth ?? 0) },
      value,
    });
  }

  const confidence: Valuation["confidence"] =
    basis === "mercado"
      ? used.length >= 3
        ? "alta"
        : "media"
      : basis === "compra"
        ? yearsSince(parseLooseDate(work.acquisitionDate)!, today) <= 10
          ? "media"
          : "baja"
        : basis
          ? "baja"
          : null;

  return { suggested: value === null ? null : round(value), basis, confidence, steps, used, notes };
}

/** Settings strings → rules; anything unreadable falls back to the default. */
export function rulesFromSettings(read: (key: string) => string | undefined): ValuationRules {
  const num = (key: string, fallback: number, scale = 1) => {
    const n = Number(String(read(key) ?? "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 && String(read(key) ?? "").trim() !== "" ? n / scale : fallback;
  };
  return {
    annualRate: num("valuation.annualRate", DEFAULT_RULES.annualRate, 100),
    deathMultiplier: num("valuation.deathMultiplier", DEFAULT_RULES.deathMultiplier),
    hotMultiplier: num("valuation.hotMultiplier", DEFAULT_RULES.hotMultiplier),
    recentYears: num("valuation.recentYears", DEFAULT_RULES.recentYears),
    hotMinSales: num("valuation.hotMinSales", DEFAULT_RULES.hotMinSales),
    hotGrowth: num("valuation.hotGrowth", DEFAULT_RULES.hotGrowth, 100),
  };
}
