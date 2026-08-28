"use client";

import { motion } from "framer-motion";

export default function Contact() {
  return (
    <main className="min-h-screen pt-48 pb-32 px-6 md:px-12 lg:px-24 flex items-center justify-center bg-neutral-100">
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-2xl w-full bg-white p-12 md:p-24 shadow-2xl border border-black/5 text-center text-black"
      >
        <h1 className="font-serif text-5xl md:text-7xl font-light mb-8 text-black">Contact</h1>
        <p className="font-serif text-xl text-neutral-600 mb-16">
          For inquiries regarding the collection, exhibitions, or private viewing rooms, please reach out to the curator.
        </p>
        
        <a 
          href="mailto:ottoreyes88@gmail.com"
          className="group relative inline-flex items-center justify-center py-6 px-12 border border-black hover:bg-black transition-colors duration-500 overflow-hidden text-black hover:text-white"
        >
          <span className="font-display text-[10px] uppercase tracking-[0.2em] font-bold z-10">ottoreyes88@gmail.com</span>
          <div className="absolute inset-0 bg-black translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"></div>
          <span className="absolute font-display text-[10px] uppercase tracking-[0.2em] font-bold text-white z-10 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">ottoreyes88@gmail.com</span>
        </a>
      </motion.div>
    </main>
  );
}
