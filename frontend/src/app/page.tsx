"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function Home() {
  return (
    <main className="relative w-full pb-32">
      {/* Gallery Walk - Pacing through Extreme Whitespace */}
      <section className="min-h-[100vh] flex flex-col justify-center items-center px-8">
        <div className="max-w-4xl text-center flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.95, filter: "blur(10px)", opacity: 0 }}
            animate={{ scale: 1, filter: "blur(0px)", opacity: 1 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl font-light leading-tight tracking-tight">
              An exploration of<br/>contemporary visual narratives.
            </h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
          >
            <p className="font-display text-[9px] uppercase tracking-[0.3em] text-neutral-400 mt-12 font-bold">
              Est. 2005 &mdash; San Juan, Puerto Rico
            </p>
          </motion.div>
        </div>
      </section>

      {/* Example Artworks / Container Queries for Immaculate Scaling */}
      <section className="px-6 md:px-12 lg:px-24 @container">
        <div className="flex flex-col space-y-[20vh] md:space-y-[30vh]">
          {/* Piece 1 */}
          <motion.article 
            initial={{ opacity: 0, y: 100 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col @4xl:flex-row gap-12 @4xl:gap-24 items-center"
          >
            <figure className="w-full @4xl:w-[70%] group">
              <div className="aspect-[4/5] bg-neutral-100 relative w-full overflow-hidden">
                <Image 
                  src={`${process.env.NEXT_PUBLIC_IMAGE_HOST || ''}/wp-content/uploads/2021/01/Ruiz-Aby.-0133-thumb.jpg`}
                  alt="La Tempestad"
                  fill
                  className="object-contain p-12 mix-blend-multiply opacity-90 group-hover:scale-[1.03] transition-transform duration-[2s] ease-out"
                />
              </div>
            </figure>
            <div className="w-full @4xl:w-[30%] flex flex-col space-y-8">
              <header className="space-y-4">
                <h3 className="font-serif text-4xl lg:text-5xl leading-tight">La Tempestad</h3>
                <p className="font-display text-[10px] uppercase tracking-widest font-bold">Carmelo Sobrino</p>
              </header>
              <div className="font-serif text-xl text-neutral-500 space-y-2">
                <p>Óleo sobre lienzo, 1998.</p>
                <p className="text-base">Exhibited at Museo de Arte de Puerto Rico.</p>
              </div>
              <a href="/gallery" className="inline-block text-left font-display text-[10px] uppercase tracking-widest underline underline-offset-8 text-neutral-400 hover:text-black transition-colors pt-4">
                View Details
              </a>
            </div>
          </motion.article>
          
          {/* Piece 2 */}
          <motion.article 
            initial={{ opacity: 0, y: 100 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col @4xl:flex-row-reverse gap-12 @4xl:gap-24 items-center"
          >
            <figure className="w-full @4xl:w-[60%] group">
              <div className="aspect-[16/9] bg-neutral-100 relative w-full overflow-hidden">
                <Image 
                  src={`${process.env.NEXT_PUBLIC_IMAGE_HOST || ''}/wp-content/uploads/2020/09/Arana-Alfonso.-0125d-thumb.jpg`}
                  alt="El Retrato"
                  fill
                  className="object-contain p-12 mix-blend-multiply opacity-90 group-hover:scale-[1.03] transition-transform duration-[2s] ease-out"
                />
              </div>
            </figure>
            <div className="w-full @4xl:w-[40%] flex flex-col space-y-8 @4xl:text-right">
              <header className="space-y-4">
                <h3 className="font-serif text-4xl lg:text-5xl leading-tight">El Retrato</h3>
                <p className="font-display text-[10px] uppercase tracking-widest font-bold">Myrna Báez</p>
              </header>
              <div className="font-serif text-xl text-neutral-500 space-y-2">
                <p>Acrílico sobre panel, 1985.</p>
              </div>
              <a href="/gallery" className="inline-block font-display text-[10px] uppercase tracking-widest underline underline-offset-8 text-neutral-400 hover:text-black transition-colors pt-4 @4xl:ml-auto">
                View Details
              </a>
            </div>
          </motion.article>
        </div>
      </section>
    </main>
  );
}
