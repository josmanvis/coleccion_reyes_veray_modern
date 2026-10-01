"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

type Hit = { kind: string; id: string; title: string; subtitle: string; href: string };
type Results = { query: string; total: number; groups: Array<{ kind: string; label: string; hits: Hit[] }> };

const EMPTY: Results = { query: "", total: 0, groups: [] };

/**
 * Global search in the app bar, the way Microsoft 365 places it. Opens with
 * Ctrl/Cmd+K, searches obras, artistas, portafolios, ubicaciones and páginas,
 * and is navigable from the keyboard.
 */
export default function OmniSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Derived rather than stored, so a short query needs no state write.
  const ready = query.trim().length >= 2;
  const visible = ready ? results : EMPTY;
  const flat = visible.groups.flatMap((group) => group.hits);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (event.key === "Escape") setOpen(false);
    }
    function onClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          setResults((await response.json()) as Results);
          setActive(0);
        }
      } catch {
        /* superseded by a newer keystroke */
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function go(hit: Hit) {
    setOpen(false);
    setQuery("");
    router.push(hit.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && flat[active]) {
      event.preventDefault();
      go(flat[active]);
    }
  }

  let index = -1;

  return (
    <div ref={boxRef} className="relative w-full max-w-[520px]">
      <Search
        size={15}
        strokeWidth={1.75}
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open && visible.total > 0}
        aria-controls="omnisearch-results"
        value={query}
        placeholder="Buscar obras, artistas, ubicaciones…"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-[var(--radius)] border border-transparent bg-white/95 py-1.5 pl-8 pr-16 text-sm text-[var(--ink-1)] outline-none transition placeholder:text-[var(--ink-4)] focus:border-white"
      />
      {query ? (
        <button
          type="button"
          aria-label="Limpiar"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--ink-3)] hover:bg-[var(--hover)]"
        >
          <X size={14} strokeWidth={2} aria-hidden />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[var(--stroke)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink-3)]">
          ⌘K
        </kbd>
      )}

      {open && query.trim().length >= 2 && (
        <div
          id="omnisearch-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] overflow-y-auto rounded-[var(--radius)] border border-[var(--stroke-soft)] bg-[var(--surface)] py-1 shadow-[var(--shadow-16)]"
        >
          {visible.total === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--ink-3)]">
              Sin resultados para “{query.trim()}”
            </p>
          ) : (
            visible.groups.map((group) => (
              <div key={group.kind}>
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                  {group.label}
                </p>
                {group.hits.map((hit) => {
                  index += 1;
                  const isActive = index === active;
                  return (
                    <Link
                      key={`${hit.kind}-${hit.id}`}
                      href={hit.href}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex items-baseline gap-2 px-3 py-1.5 text-sm transition-colors ${
                        isActive ? "bg-[var(--brand-soft)]" : "hover:bg-[var(--hover)]"
                      }`}
                    >
                      <span className="truncate text-[var(--ink-1)]">{hit.title}</span>
                      <span className="ml-auto shrink-0 truncate text-xs text-[var(--ink-3)]">
                        {hit.subtitle}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
