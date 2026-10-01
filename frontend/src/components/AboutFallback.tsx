"use client";

import { motion } from "framer-motion";
import { t, type Locale } from "@/lib/i18n";

export default function AboutFallback({ locale }: { locale: Locale }) {
  return (
    <main className="min-h-screen pt-48 pb-32 px-6 md:px-12 lg:px-24 bg-black text-white selection:bg-white selection:text-black">
      <header className="mb-32 max-w-4xl">
        <motion.h1 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif text-5xl md:text-7xl lg:text-8xl font-light tracking-tight leading-tight"
        >
          Otto Octavio<br/>Reyes Casanova
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="font-display text-[10px] uppercase tracking-[0.2em] text-neutral-400 mt-12 leading-loose max-w-md"
        >
          {t(locale, "about.role")}
        </motion.p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-24 border-t border-white/20 pt-24">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="space-y-8 font-serif text-2xl md:text-3xl font-light leading-relaxed text-neutral-300 max-w-3xl"
        >
          <p>
            {t(locale, "about.p1")}
          </p>
          <p className="text-xl text-neutral-400">
            {t(locale, "about.p2")}
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, delay: 0.2 }}
          className="font-display text-[10px] uppercase tracking-widest text-neutral-500 space-y-4"
        >
          <h2 className="text-white mb-8">{t(locale, "about.index")}</h2>
          <ul className="space-y-4">
            <li><a href="/gallery" className="hover:text-white transition-colors">{t(locale, "about.catalogue")}</a></li>
            <li><a href="/exhibition" className="hover:text-white transition-colors">{t(locale, "about.macExhibition")}</a></li>
            <li><a href="/contact" className="hover:text-white transition-colors">{t(locale, "about.inquiries")}</a></li>
          </ul>
        </motion.div>
      </section>
    </main>
  );
}