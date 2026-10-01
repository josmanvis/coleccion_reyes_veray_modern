"use client";

import { useEffect } from "react";

/**
 * Marks the document when running inside CRVMGMT so the shell can leave room
 * for the macOS traffic lights. Writing an attribute on the document is exactly
 * the kind of external-system sync an effect is for.
 */
export default function DesktopChrome() {
  useEffect(() => {
    const isDesktop = Boolean((window as unknown as { crvmgmt?: unknown }).crvmgmt);
    if (!isDesktop) return;
    document.documentElement.dataset.desktop = "true";
    return () => {
      delete document.documentElement.dataset.desktop;
    };
  }, []);

  return null;
}
