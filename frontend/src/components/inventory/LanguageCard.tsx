"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { CARD, MUTED, LABEL, FIELD } from "./ui";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { setLocaleCookie } from "@/lib/locale-action";

export default function LanguageCard({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Locale>(currentLocale);
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
    <section className={`${CARD} p-4`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Globe size={16} strokeWidth={1.75} aria-hidden />
        Idioma
      </h2>
      <p className={`mt-1 text-sm ${MUTED}`}>
        El idioma en el que ves el sitio público y las salas de visualización.
      </p>

      <div className="mt-4 max-w-xs">
        <span className={LABEL}>Idioma</span>
        <select
          value={current}
          onChange={(e) => choose(e.target.value as Locale)}
          disabled={pending}
          className={FIELD}
        >
          {LOCALES.map((loc) => (
            <option key={loc} value={loc}>
              {LOCALE_LABELS[loc]}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
