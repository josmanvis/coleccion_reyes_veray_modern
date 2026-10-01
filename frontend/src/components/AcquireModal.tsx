"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { t, type Locale } from "@/lib/i18n";

export default function AcquireModal({
  artworkTitle,
  artworkImage,
  artworkSlug,
  isOpen,
  onClose,
  locale,
}: {
  artworkTitle: string;
  artworkImage: string;
  artworkSlug?: string;
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          message,
          artworkTitle,
          artworkSlug,
          artworkImage,
          source: "coleccion-acquire-modal",
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("sent");
      setTimeout(onClose, 2500);
    } catch {
      // Fallback: draft the inquiry via the visitor's email client
      setStatus("idle");
      const subject = encodeURIComponent(t(locale, "acquire.mailSubject", { title: artworkTitle }));
      const body = encodeURIComponent(t(locale, "acquire.mailBody", { title: artworkTitle, name, email }));
      window.location.href = `mailto:ottoreyes88@gmail.com?subject=${subject}&body=${body}`;
      onClose();
    }
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
              <h2 className="font-display text-[10px] uppercase tracking-widest font-bold">{t(locale, "acquire.title")}</h2>
              <button onClick={onClose} className="font-display text-[10px] uppercase tracking-widest hover:opacity-50 transition-opacity">
                {t(locale, "nav.close")}
              </button>
            </div>
            
            <div className="p-8 flex-1 overflow-y-auto">
              <div className="mb-12">
                <div className="aspect-[4/3] relative bg-neutral-100 mb-6 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={artworkImage} alt={artworkTitle} className="w-full h-full object-contain p-4 mix-blend-multiply" />
                </div>
                <h3 className="font-serif text-2xl font-light leading-tight">{artworkTitle}</h3>
                <p className="font-serif text-neutral-500 mt-2">{t(locale, "acquire.private")}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-2">
                  <label className="font-display text-[9px] uppercase tracking-widest font-bold text-neutral-400">{t(locale, "form.name")}</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border-b border-black/20 pb-2 bg-transparent font-serif text-lg focus:outline-none focus:border-black transition-colors rounded-none"
                    placeholder={t(locale, "form.namePlaceholder")}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="font-display text-[9px] uppercase tracking-widest font-bold text-neutral-400">{t(locale, "form.email")}</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border-b border-black/20 pb-2 bg-transparent font-serif text-lg focus:outline-none focus:border-black transition-colors rounded-none"
                    placeholder="jane@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-display text-[9px] uppercase tracking-widest font-bold text-neutral-400">{t(locale, "form.messageOptional")}</label>
                  <textarea 
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full border-b border-black/20 pb-2 bg-transparent font-serif text-lg focus:outline-none focus:border-black transition-colors rounded-none resize-none"
                    placeholder={t(locale, "acquire.messagePlaceholder")}
                  />
                </div>

                <div className="pt-8">
                  <p className="font-serif text-sm text-neutral-500 mb-8 leading-relaxed">
                    {t(locale, "acquire.notice")}
                  </p>
                  
                  <button 
                    type="submit" 
                    disabled={status === "sending" || status === "sent"}
                    className="w-full group relative flex items-center justify-center py-5 border border-black bg-black text-white hover:bg-neutral-800 transition-colors duration-500 overflow-hidden disabled:opacity-70"
                  >
                    <span className="font-display text-[10px] uppercase tracking-[0.2em] font-bold z-10">
                      {status === "sending" ? t(locale, "form.sending") : status === "sent" ? t(locale, "acquire.received") : t(locale, "acquire.submit")}
                    </span>
                  </button>
                  {status === "error" && (
                    <p className="font-serif text-sm text-red-600 mt-4">{t(locale, "acquire.error")}</p>
                  )}
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
