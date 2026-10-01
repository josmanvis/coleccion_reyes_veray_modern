/**
 * Sending a link to another device — AirDrop, Messages, Mail. CRVMGMT opens
 * the native macOS share menu through the preload bridge; a browser uses the
 * Web Share sheet where it has one (Safari, Chrome on macOS and phones).
 *
 * No imports: used by client components and the context-menu builders.
 */

type Bridge = { shareUrl?: (payload: { url: string; title?: string }) => Promise<boolean> };

function bridge(): Bridge | undefined {
  return (window as unknown as { crvmgmt?: Bridge }).crvmgmt;
}

export function canShare(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(bridge()?.shareUrl) || typeof navigator.share === "function";
}

/** Apple devices show AirDrop first in the share menu, so name it. */
export function shareLabel(tr: (es: string) => string): string {
  const apple = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
  return apple ? tr("AirDrop…") : tr("Compartir…");
}

/** Resolves false when nothing could be shown; a dismissed sheet is not an error. */
export async function shareLink(url: string, title?: string): Promise<boolean> {
  const desktop = bridge();
  if (desktop?.shareUrl) return desktop.shareUrl({ url, title });
  if (typeof navigator.share !== "function") return false;
  try {
    await navigator.share({ url, title });
  } catch (error) {
    if ((error as Error).name !== "AbortError") throw error;
  }
  return true;
}
