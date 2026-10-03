"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { t, type Locale } from "@/lib/i18n";

export default function ExhibitionFallback({ locale }: { locale: Locale }) {
  return (
    <main className="min-h-screen pt-48 pb-32 px-6 md:px-12 lg:px-24">
      <header className="mb-32 max-w-3xl">
        <motion.h1 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif text-4xl md:text-6xl lg:text-7xl font-light tracking-tight leading-tight"
        >
          {t(locale, "exhibition.title")}
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="font-display text-[10px] uppercase tracking-[0.2em] text-neutral-400 mt-12 leading-loose max-w-md"
        >
          {t(locale, "exhibition.sub")}
        </motion.p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-24">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="space-y-8 font-serif text-xl leading-relaxed text-neutral-600 max-w-2xl"
        >
          <p>
            {t(locale, "exhibition.p1")}
          </p>
          <p>
            {t(locale, "exhibition.p2")}
          </p>
          <div className="pt-12">
             <Link href="/gallery" className="font-display text-[10px] uppercase tracking-widest underline underline-offset-8 text-black hover:text-neutral-400 transition-colors">
               {t(locale, "exhibition.explore")}
             </Link>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative aspect-square bg-neutral-100 p-8"
        >
           <div className="w-full h-full border border-black/10 flex flex-col items-center justify-center text-center p-12">
              <span className="font-serif text-3xl italic text-neutral-300">MAC</span>
              <span className="font-display text-[9px] uppercase tracking-widest text-neutral-400 mt-4">{t(locale, "exhibition.museum")}</span>
           </div>
        </motion.div>
      </section>
    </main>
  );
}