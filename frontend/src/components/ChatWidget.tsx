"use client";

import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

export default function ChatWidget({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "agent"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "agent", text: data.reply || data.error }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "agent", text: t(locale, "chat.error") }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end" style={{ fontFamily: "var(--font-ui), system-ui, sans-serif" }}>
      {open && (
        <div className="mb-4 flex h-[450px] w-[350px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-black px-4 py-3 text-white">
            <span className="text-sm font-semibold tracking-wide">OCHO AI</span>
            <button onClick={() => setOpen(false)} className="opacity-70 transition-opacity hover:opacity-100">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-sm text-gray-400 mt-10">
                {t(locale, "chat.empty")}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-black text-white self-end rounded-br-sm"
                    : "bg-white border border-gray-200 text-gray-800 self-start rounded-bl-sm shadow-sm whitespace-pre-wrap"
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="self-start rounded-2xl bg-white border border-gray-200 px-4 py-2.5 text-sm text-gray-500 shadow-sm rounded-bl-sm">
                {t(locale, "chat.thinking")}
              </div>
            )}
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-gray-200 bg-white p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t(locale, "chat.placeholder")}
              className="flex-1 rounded-full border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-black focus:bg-white"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              <Send size={16} className="-ml-0.5" />
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-xl transition-transform hover:scale-110"
        aria-label={t(locale, "chat.open")}
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}
