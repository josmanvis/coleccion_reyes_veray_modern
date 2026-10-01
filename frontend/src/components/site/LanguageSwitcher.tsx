"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { setLocaleCookie } from "@/lib/locale-action";

/**
 * The choice is stored by a server action rather than `document.cookie`, so the
 * very next render on the server already knows the language.
 */
export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Locale>(locale);
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === current || pending) return;
    setCurrent(next);
    startTransition(async () => {
      await setLocaleCookie(next);
      router.refresh();
    });
  }

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-current={option === current}
          onClick={() => choose(option)}
          className={`uppercase tracking-[0.3em] transition-opacity duration-500 ${
            option === current
              ? "opacity-90 underline underline-offset-4"
              : "opacity-25 hover:opacity-70"
          }`}
        >
          {option === "en" ? "EN" : "ES"}
          <span className="sr-only"> — {LOCALE_LABELS[option]}</span>
        </button>
      ))}
    </div>
  );
}
