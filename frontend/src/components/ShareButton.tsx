"use client";

import { Share2 } from "lucide-react";

export default function ShareButton({ title, text }: { title: string, text: string }) {
  const handleShare = async () => {
    if (typeof window !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      // Fallback for desktop/unsupported browsers: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  };

  return (
    <button 
      onClick={handleShare}
      className="group relative flex items-center justify-center p-5 border border-black hover:bg-neutral-100 transition-colors duration-500 overflow-hidden shrink-0"
      aria-label="Share"
    >
      <Share2 className="w-5 h-5 text-black group-hover:scale-110 transition-transform duration-300" strokeWidth={1.5} />
    </button>
  );
}
