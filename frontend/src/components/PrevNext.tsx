import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";

export type PrevNextLink = { href: string; label: string } | null;

/**
 * Previous / next pager used between artworks, artists and portfolio sheets.
 * Both sides keep their slot when empty so the counter stays centred.
 */
export default function PrevNext({
  previous,
  next,
  caption,
  locale,
  className = "",
}: {
  previous: PrevNextLink;
  next: PrevNextLink;
  /** e.g. "3 de 64 · Portafolio Flora de Puerto Rico" */
  caption?: string;
  locale: Locale;
  className?: string;
}) {
  const side =
    "font-display text-[10px] uppercase tracking-widest transition-opacity duration-300 hover:opacity-50";

  return (
    <nav
      aria-label={t(locale, "nav.pagination")}
      className={`flex items-center justify-between gap-4 border-t border-black/10 pt-4 ${className}`}
    >
      <div className="min-w-0 flex-1">
        {previous ? (
          <Link href={previous.href} className={`${side} block truncate`} rel="prev">
            ← {previous.label}
          </Link>
        ) : (
          <span className="block" />
        )}
      </div>

      {caption && (
        <p className="shrink-0 font-display text-[10px] uppercase tracking-widest opacity-40">
          {caption}
        </p>
      )}

      <div className="min-w-0 flex-1 text-right">
        {next ? (
          <Link href={next.href} className={`${side} block truncate`} rel="next">
            {next.label} →
          </Link>
        ) : (
          <span className="block" />
        )}
      </div>
    </nav>
  );
}
