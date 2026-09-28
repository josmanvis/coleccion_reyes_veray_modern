"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import type { Artist } from "@/lib/mac";

/** Group artists under the first letter of their surname for the A–Z index. */
function groupByInitial(artists: Artist[]): Map<string, Artist[]> {
  const groups = new Map<string, Artist[]>();
  for (const a of artists) {
    const last = a.name.trim().split(" ").pop() || a.name;
    const letter = last.normalize("NFD").replace(/[\u0300-\u036f]/g, "")[0]?.toUpperCase() ?? "#";
    const list = groups.get(letter) ?? [];
    list.push(a);
    groups.set(letter, list);
  }
  for (const [, list] of groups) {
    list.sort((x, y) => x.name.localeCompare(y.name, "es"));
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export default function ArtistsIndex({ artists }: { artists: Artist[] }) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? artists.filter(
          (a) =>
            a.name.toLowerCase().includes(q) || (a.bio ?? "").toLowerCase().includes(q)
        )
      : artists;
    return groupByInitial(filtered);
  }, [artists, query]);

  const letters = Array.from(groups.keys());
  const total = Array.from(groups.values()).reduce((n, g) => n + g.length, 0);

  return (
    <main className="min-h-screen pt-48 pb-32 px-6 md:px-12 lg:px-24">
      <header className="mb-24 max-w-4xl">
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif text-5xl md:text-7xl lg:text-8xl font-light tracking-tight leading-tight"
        >
          Índice
        </motion.h1>
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-neutral-400 mt-12 leading-loose max-w-md">
          {artists.length} artistas representados en la colección
        </p>

        <div className="relative mt-16 max-w-md">
          <Search
            className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
            strokeWidth={1.5}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar artista… / Search artist…"
            aria-label="Search artists"
            className="w-full border-b border-black/20 bg-transparent pl-7 pb-2 font-serif text-lg focus:outline-none focus:border-black transition-colors"
          />
        </div>

        {!query && letters.length > 0 && (
          <nav
            aria-label="Jump to letter"
            className="mt-12 flex flex-wrap gap-x-4 gap-y-2 font-display text-[10px] uppercase tracking-widest"
          >
            {letters.map((l) => (
              <a
                key={l}
                href={`#letter-${l}`}
                className="text-neutral-400 hover:text-black transition-colors"
              >
                {l}
              </a>
            ))}
          </nav>
        )}
      </header>

      {total === 0 ? (
        <p className="font-serif text-xl text-neutral-500">
          {query ? "No artists match that search." : "No artists found."}
        </p>
      ) : (
        <div className="space-y-20">
          {Array.from(groups.entries()).map(([letter, list]) => (
            <section key={letter} id={`letter-${letter}`} className="scroll-mt-40">
              <h2 className="font-display text-[10px] uppercase tracking-[0.2em] text-neutral-400 border-b border-black/10 pb-4 mb-8">
                {letter}
              </h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-1">
                {list.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/artist/${a.slug}`}
                      className="group flex items-baseline justify-between gap-4 py-2 border-b border-black/5 hover:border-black/30 transition-colors"
                    >
                      <span className="font-serif text-lg md:text-xl font-light group-hover:opacity-60 transition-opacity">
                        {a.name}
                      </span>
                      <span className="font-display text-[9px] uppercase tracking-widest text-neutral-400 shrink-0">
                        {a.lifespan || (a.artworkCount ? `${a.artworkCount} obras` : "")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
