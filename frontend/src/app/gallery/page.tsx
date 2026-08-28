"use client";

import { useState, useEffect, useRef } from "react";
import { getImageUrl } from "@/lib/getImageUrl";
import data from "@/data/artworks.json";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

type Artwork = {
  title: string;
  url: string;
  images: string[];
  description?: string;
  ut_high?: string;
  ut_thumb?: string;
};

export default function Gallery() {
  const artworks = data as Artwork[];
  
  // Performance: Lazy load items 30 at a time
  const [visibleCount, setVisibleCount] = useState(30);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 30, artworks.length));
        }
      },
      { threshold: 0.1, rootMargin: "500px" }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [artworks.length]);

  return (
    <>
      <main className="min-h-screen pt-48 pb-32 px-6 md:px-12 lg:px-24">
        <header className="mb-32 max-w-3xl">
          <motion.h1 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif text-5xl md:text-7xl lg:text-8xl font-light tracking-tight"
          >
            Inventory
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="font-display text-[10px] uppercase tracking-[0.2em] text-neutral-400 mt-12 leading-loose max-w-md"
          >
            Accessing secure viewing room. Complete collection provenance and high-resolution asset management. {artworks.length} indexed records.
          </motion.p>
        </header>
        
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-32">
          {artworks.slice(0, visibleCount).map((artwork, i) => (
            <motion.article 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              key={i} 
              className="flex flex-col space-y-8"
            >
              <Link href={`/art${artwork.url.replace('/index.html', '')}`}>
                <figure 
                  className="relative aspect-[3/4] bg-neutral-100 overflow-hidden group cursor-pointer flex items-center justify-center p-8"
                >
                  {artwork.images.length > 0 ? (
                    <Image 
                      src={
                        artwork.ut_thumb || getImageUrl(artwork.images[0], true)
                      }
                      alt={artwork.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-contain p-8 mix-blend-multiply opacity-90 group-hover:scale-105 transition-transform duration-[1.5s] ease-out" 
                      loading={i < 6 ? "eager" : "lazy"}
                      quality={85}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-neutral-100 flex items-center justify-center">
                       <span className="font-display text-[10px] text-neutral-400 uppercase tracking-widest">Asset Pending</span>
                    </div>
                  )}
                  {/* Image Overlay for Awwwards style interaction */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-700 pointer-events-none"></div>
                </figure>
              </Link>
              
              <div className="flex justify-between items-start border-t border-black/10 pt-6">
                <div className="max-w-[80%]">
                  <h2 className="font-serif text-2xl md:text-3xl font-light line-clamp-2 leading-snug">{artwork.title}</h2>
                </div>
                <Link 
                  href={`/art${artwork.url.replace('/index.html', '')}`}
                  className="font-display text-[9px] uppercase tracking-[0.2em] font-bold hover:text-neutral-400 transition-colors mt-2"
                >
                  Examine
                </Link>
              </div>
            </motion.article>
          ))}
        </section>

        {/* Infinite Scroll Trigger */}
        {visibleCount < artworks.length && (
          <div ref={observerTarget} className="w-full h-32 flex items-center justify-center mt-24">
             <span className="w-1.5 h-1.5 rounded-full bg-black block animate-ping"></span>
          </div>
        )}
      </main>
    </>
  );
}
