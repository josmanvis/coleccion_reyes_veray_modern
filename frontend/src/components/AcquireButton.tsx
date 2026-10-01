"use client";

import { useState } from "react";
import AcquireModal from "./AcquireModal";
import { t, type Locale } from "@/lib/i18n";

export default function AcquireButton({
  artworkTitle,
  artworkImage,
  artworkSlug,
  locale,
  className = ""
}: {
  artworkTitle: string;
  artworkImage: string;
  artworkSlug?: string;
  locale: Locale;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`group relative flex items-center justify-center py-5 px-4 border border-black bg-black text-white hover:bg-neutral-800 transition-colors duration-500 overflow-hidden ${className}`}
      >
        <span className="font-display text-[11px] md:text-[10px] uppercase tracking-[0.2em] font-bold z-10 text-center text-balance">
          <span className="md:hidden">{t(locale, "acquire.short")}</span>
          <span className="hidden md:inline">{t(locale, "acquire.long")}</span>
        </span>
      </button>

      <AcquireModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        artworkTitle={artworkTitle}
        artworkImage={artworkImage}
        artworkSlug={artworkSlug}
        locale={locale}
      />
    </>
  );
}
