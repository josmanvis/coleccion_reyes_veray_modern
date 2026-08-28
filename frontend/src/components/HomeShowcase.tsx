"use client";

import { getImageUrl } from "@/lib/getImageUrl";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { Artwork } from "@/lib/mac";

export default function HomeShowcase({ featured }: { featured: Artwork[] }) {
  const pieces = featured.slice(0, 2);

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
          {pieces.map((artwork, index) => {
            const even = index % 2 === 0;
            const image = artwork.images[0] || artwork.ut_high || "";
            return (
              <motion.article
                key={artwork.slug || index}
                initial={{ opacity: 0, y: 100 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-20%" }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className={`flex flex-col ${even ? "@4xl:flex-row" : "@4xl:flex-row-reverse"} gap-12 @4xl:gap-24 items-center`}
              >
                <figure className={`w-full ${even ? "@4xl:w-[70%]" : "@4xl:w-[60%]"} group`}>
                  <div className={`${even ? "aspect-[4/5]" : "aspect-[16/9]"} bg-neutral-100 relative w-full overflow-hidden`}>
                    {image && (
                      <Image
                        src={getImageUrl(image, true)}
                        alt={artwork.title}
                        fill
                        className="object-contain p-12 mix-blend-multiply opacity-90 group-hover:scale-[1.03] transition-transform duration-[2s] ease-out"
                      />
                    )}
                  </div>
                </figure>
                <div className={`w-full ${even ? "@4xl:w-[30%]" : "@4xl:w-[40%]"} flex flex-col space-y-8 ${even ? "" : "@4xl:text-right"}`}>
                  <header className="space-y-4">
                    <h3 className="font-serif text-4xl lg:text-5xl leading-tight">{artwork.title}</h3>
                  </header>
                  {artwork.description && (
                    <div className="font-serif text-xl text-neutral-500 space-y-2 line-clamp-3">
                      {artwork.description}
                    </div>
                  )}
                  <Link
                    href={`/art/${artwork.slug}`}
                    className={`inline-block text-left font-display text-[10px] uppercase tracking-widest underline underline-offset-8 text-neutral-400 hover:text-black transition-colors pt-4 ${even ? "" : "@4xl:ml-auto"}`}
                  >
                    View Details
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>
    </main>
  );
}