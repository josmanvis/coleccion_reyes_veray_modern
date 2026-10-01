/**
 * Shared admin styling, Fluent/Microsoft 365 flavoured.
 *
 * Class strings rather than components so both server and client surfaces can
 * use them, and so a control keeps the same shape wherever it appears. Colours
 * come from the tokens on `.admin-shell` in globals.css.
 *
 * No imports: client components pull from here (see project-client-server-module-split).
 */

/** Filled brand button — one primary action per view. */
export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius)] bg-[var(--brand)] px-3.5 py-[7px] text-sm font-semibold text-[var(--on-brand)] transition-colors hover:bg-[var(--brand-hover)] active:bg-[var(--brand-pressed)] disabled:cursor-not-allowed disabled:bg-[var(--stroke)] disabled:text-[var(--ink-4)]";

/** Outlined default button. */
export const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius)] border border-[var(--stroke)] bg-[var(--surface)] px-3.5 py-[7px] text-sm font-semibold text-[var(--ink-1)] transition-colors hover:bg-[var(--hover)] active:bg-[var(--selected)] disabled:cursor-not-allowed disabled:border-[var(--stroke-soft)] disabled:text-[var(--ink-4)]";

/** Borderless button, for command bars and toolbars. */
export const BTN_SUBTLE =
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius)] px-3 py-[7px] text-sm font-semibold text-[var(--ink-1)] transition-colors hover:bg-[var(--hover)] active:bg-[var(--selected)] disabled:cursor-not-allowed disabled:text-[var(--ink-4)]";

export const BTN_DANGER =
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius)] border border-[color:var(--danger)] bg-[var(--surface)] px-3.5 py-[7px] text-sm font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]";

/** Text input, select and textarea share one field treatment. */
export const FIELD =
  "w-full rounded-[var(--radius)] border border-[var(--stroke)] bg-[var(--surface)] px-2.5 py-[6px] text-sm text-[var(--ink-1)] outline-none transition-colors placeholder:text-[var(--ink-4)] hover:border-[var(--ink-4)] focus:border-[var(--brand)]";

export const LABEL = "mb-1 block text-xs font-semibold text-[var(--ink-2)]";

/** White surface with a hairline and Fluent's smallest elevation. */
export const CARD =
  "rounded-[var(--radius)] border border-[var(--stroke-soft)] bg-[var(--surface)] shadow-[var(--shadow-2)]";

/** Section heading inside a card. */
export const SECTION_TITLE = "text-sm font-semibold text-[var(--ink-1)]";

/** The small all-caps caption Fluent uses above groups of fields. */
export const OVERLINE =
  "text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-3)]";

export const MUTED = "text-[var(--ink-3)]";

/** Page shell: a command bar sits above content on the canvas. */
export const PAGE = "mx-auto w-full max-w-[1600px] px-6 py-5";

export const COMMAND_BAR =
  "flex flex-wrap items-center gap-2 border-b border-[var(--stroke-soft)] bg-[var(--surface)] px-6 py-2";

export type Tone = "neutral" | "success" | "warning" | "danger" | "brand";

/** Fluent badges: tinted background, full-strength text, hairline border. */
export const BADGE: Record<Tone, string> = {
  neutral:
    "inline-flex items-center whitespace-nowrap rounded-[var(--radius)] border border-[var(--stroke)] bg-[var(--surface-alt)] px-2 py-0.5 text-xs font-semibold text-[var(--ink-2)]",
  success:
    "inline-flex items-center whitespace-nowrap rounded-[var(--radius)] border border-[color:var(--success)]/30 bg-[var(--success-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--success)]",
  warning:
    "inline-flex items-center whitespace-nowrap rounded-[var(--radius)] border border-[color:var(--warning)]/30 bg-[var(--warning-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--warning)]",
  danger:
    "inline-flex items-center whitespace-nowrap rounded-[var(--radius)] border border-[color:var(--danger)]/30 bg-[var(--danger-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--danger)]",
  brand:
    "inline-flex items-center whitespace-nowrap rounded-[var(--radius)] border border-[color:var(--brand)]/30 bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--brand-hover)]",
};
