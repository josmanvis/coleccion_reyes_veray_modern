import { getSiteSettings } from "@/lib/mac";

/**
 * Minimal site footer. "Powered by Axxes" branding is always rendered but
 * visually subtle — opacity-low, bottom-anchored, hover to reveal. The tenant
 * controls visibility and style through BAC website settings.
 */
export default async function Footer() {
  const settings = await getSiteSettings();
  const showPowered = settings?.settings?.showPoweredBy !== "false";
  const footerStyle = settings?.settings?.footerStyle || "minimal";
  // "minimal" or "none" → keep it tiny. Anything else → add footerText.
  const extra = footerStyle === "full" && settings?.settings?.footerText
    ? settings.settings.footerText
    : null;

  if (!showPowered && !extra) return null;

  return (
    <footer className="font-display fixed bottom-0 left-0 w-full px-6 md:px-12 py-6 text-[9px] uppercase tracking-[0.3em] text-neutral-300 hover:text-neutral-800 transition-colors duration-500 pointer-events-none z-40">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          {extra && <span className="opacity-40">{extra}</span>}
        </div>
        {showPowered && (
          <a
            href="https://axxes.club"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-25 hover:opacity-100 transition-opacity duration-500"
            aria-label="Powered by Axxes Club"
          >
            Powered by <span className="font-bold text-black/70">Axxes</span>.club
          </a>
        )}
      </div>
    </footer>
  );
}