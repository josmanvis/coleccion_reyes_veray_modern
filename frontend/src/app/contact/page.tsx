"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, source: "coleccion-contact-page" }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("sent");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  };

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

        {status === "sent" ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12">
            <p className="font-serif text-3xl font-light mb-4">Thank you.</p>
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-neutral-400">
              Your inquiry has been logged with the gallery. We will be in touch shortly.
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8 text-left">
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
            <div className="space-y-2">
              <label className="font-display text-[9px] uppercase tracking-widest font-bold text-neutral-400">Message</label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full border-b border-black/20 pb-2 bg-transparent font-serif text-lg focus:outline-none focus:border-black transition-colors rounded-none resize-none"
                placeholder="How can we help?"
              />
            </div>
            <button
              type="submit"
              disabled={status === "sending"}
              className="group relative w-full inline-flex items-center justify-center py-6 border border-black hover:bg-black hover:text-white transition-colors duration-500 overflow-hidden disabled:opacity-70"
            >
              <span className="font-display text-[10px] uppercase tracking-[0.2em] font-bold z-10">
                {status === "sending" ? "Sending…" : "Send Inquiry"}
              </span>
            </button>
            {status === "error" && (
              <p className="font-serif text-sm text-red-600 text-center">
                Something went wrong — please try again or email ottoreyes88@gmail.com directly.
              </p>
            )}
          </form>
        )}
      </motion.div>
    </main>
  );
}
