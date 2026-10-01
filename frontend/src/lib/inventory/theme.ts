/**
 * Per-person accent colour.
 *
 * Everyone works in the same CRVMGMT, so the accent is a preference on the
 * account rather than an app-wide setting: two people at two machines can each
 * have their own without arguing about it.
 *
 * The five brand tokens are derived from one colour instead of being listed per
 * preset, which is what lets a hand-typed hex behave exactly like a preset.
 *
 * No imports: client components read from here (see project-client-server-module-split).
 */

export type AccentTokens = {
  brand: string;
  brandHover: string;
  brandPressed: string;
  brandSoft: string;
  brandSoftHover: string;
  /** Black or white, whichever stays legible on the accent. */
  onBrand: string;
};

export const DEFAULT_ACCENT = "#0f6cbd";

export const ACCENT_PRESETS: Array<{ id: string; label: string; hex: string }> = [
  { id: "azure", label: "Azul", hex: "#0f6cbd" },
  { id: "teal", label: "Verde azulado", hex: "#038387" },
  { id: "forest", label: "Verde", hex: "#0e700e" },
  { id: "plum", label: "Morado", hex: "#5c2e91" },
  { id: "magenta", label: "Magenta", hex: "#bf0077" },
  { id: "rust", label: "Terracota", hex: "#a4373a" },
  { id: "amber", label: "Ámbar", hex: "#8f5700" },
  { id: "graphite", label: "Grafito", hex: "#3d3d3d" },
];

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Accepts `#abc`, `abc`, `#aabbcc`; anything else falls back to the default. */
export function normalizeHex(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!HEX.test(raw)) return DEFAULT_ACCENT;
  const body = raw.replace("#", "").toLowerCase();
  const full = body.length === 3 ? body.split("").map((c) => c + c).join("") : body;
  return `#${full}`;
}

function channels(hex: string): [number, number, number] {
  const body = normalizeHex(hex).slice(1);
  return [
    parseInt(body.slice(0, 2), 16),
    parseInt(body.slice(2, 4), 16),
    parseInt(body.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

/** `amount` of 0 keeps the colour, 1 reaches the target. */
function mix(hex: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = channels(hex);
  return toHex([
    r + (target[0] - r) * amount,
    g + (target[1] - g) * amount,
    b + (target[2] - b) * amount,
  ]);
}

/**
 * Perceived brightness (ITU-R BT.601). Used only to decide whether text on the
 * accent should be white or black, which is where the app bar and the filled
 * buttons would otherwise become unreadable on a pale accent.
 */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

export function accentTokens(hex: string | null | undefined): AccentTokens {
  const brand = normalizeHex(hex);
  const black: [number, number, number] = [0, 0, 0];
  const white: [number, number, number] = [255, 255, 255];
  return {
    brand,
    brandHover: mix(brand, black, 0.16),
    brandPressed: mix(brand, black, 0.34),
    brandSoft: mix(brand, white, 0.93),
    brandSoftHover: mix(brand, white, 0.86),
    onBrand: luminance(brand) > 160 ? "#1b1b1b" : "#ffffff",
  };
}

/** The tokens as the custom properties `.admin-shell` reads. */
export function accentStyle(hex: string | null | undefined): Record<string, string> {
  const t = accentTokens(hex);
  return {
    "--brand": t.brand,
    "--brand-hover": t.brandHover,
    "--brand-pressed": t.brandPressed,
    "--brand-soft": t.brandSoft,
    "--brand-soft-hover": t.brandSoftHover,
    "--on-brand": t.onBrand,
  };
}

/** Initials for the presence bubbles, at most two letters. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * A stable colour per person for their bubble, so the same face keeps the same
 * tint between sessions without storing one.
 */
export function bubbleColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENT_PRESETS[hash % ACCENT_PRESETS.length].hex;
}
