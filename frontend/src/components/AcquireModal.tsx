"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AcquireModal({ 
  artworkTitle, 
  artworkImage,
  isOpen, 
  onClose 
}: { 
  artworkTitle: string; 
  artworkImage: string;
  isOpen: boolean; 
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Acquisition Inquiry: ${artworkTitle}`);
    const body = encodeURIComponent(`Dear Curator,\n\I am interested in acquiring the following piece:\n\n${artworkTitle}\n\nPlease provide information regarding pricing, availability, and shipping logistics.\n\nBest regards,\n${name}\n${email}`);
    window.location.href = `mailto:ottoreyes88@gmail.com?subject=${subject}&body=${body}`;
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-[101] shadow-2xl flex flex-col text-black"
          >
            <div className="p-8 flex justify-between items-center border-b border-black/10">
              <h2 className="font-display text-[10px] uppercase tracking-widest font-bold">Acquisition Request</h2>
              <button onClick={onClose} className="font-display text-[10px] uppercase tracking-widest hover:opacity-50 transition-opacity">
                Close
              </button>
            </div>
            
            <div className="p-8 flex-1 overflow-y-auto">
              <div className="mb-12">
                <div className="aspect-[4/3] relative bg-neutral-100 mb-6 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={artworkImage} alt={artworkTitle} className="w-full h-full object-contain p-4 mix-blend-multiply" />
                </div>
                <h3 className="font-serif text-2xl font-light leading-tight">{artworkTitle}</h3>
                <p className="font-serif text-neutral-500 mt-2">Private Collection</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-2">
                  <label className="font-display text-[9px] uppercase tracking-widest font-bold text-neutral-400">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border-b border-black/20 pb-2 bg-transparent font-serif text-lg focus:outline-none focus:border-black transition-colors rounded-none"
                    placeholder="Jane Doe"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="font-display text-[9px] uppercase tracking-widest font-bold text-neutral-400">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border-b border-black/20 pb-2 bg-transparent font-serif text-lg focus:outline-none focus:border-black transition-colors rounded-none"
                    placeholder="jane@example.com"
                  />
                </div>

                <div className="pt-8">
                  <p className="font-serif text-sm text-neutral-500 mb-8 leading-relaxed">
                    By submitting this request, a formal inquiry will be drafted to the gallery director regarding the acquisition of this piece. You will be contacted shortly with pricing and private viewing options.
                  </p>
                  
                  <button type="submit" className="w-full group relative flex items-center justify-center py-5 border border-black bg-black text-white hover:bg-neutral-800 transition-colors duration-500 overflow-hidden">
                    <span className="font-display text-[10px] uppercase tracking-[0.2em] font-bold z-10">Request Dossier & Pricing</span>
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
