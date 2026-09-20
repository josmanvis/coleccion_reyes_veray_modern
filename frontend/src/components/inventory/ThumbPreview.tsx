"use client";

import Image from "next/image";
import { useRef, useState } from "react";

/**
 * Row thumbnail that pops a large preview on hover, so the table can be scanned
 * visually without opening each record. The popover is fixed-positioned from the
 * thumbnail's own rect, which keeps it clear of the table's overflow clipping.
 */
export default function ThumbPreview({
  src,
  alt,
  caption,
}: {
  src: string | null;
  alt: string;
  caption?: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  const SIZE = 340;

  function show() {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Prefer the right of the thumbnail; flip left when it would overflow.
    const wantsLeft = rect.right + SIZE + 24 > window.innerWidth;
    const left = wantsLeft ? rect.left - SIZE - 12 : rect.right + 12;
    const top = Math.min(
      Math.max(8, rect.top + rect.height / 2 - SIZE / 2),
      Math.max(8, window.innerHeight - SIZE - 8)
    );
    setBox({ top, left: Math.max(8, left) });
  }

  if (!src) {
    return (
      <span className="block size-10 rounded-sm border border-dashed border-neutral-300" />
    );
  }

  return (
    <span
      ref={anchorRef}
      className="relative block"
      onMouseEnter={show}
      onMouseLeave={() => setBox(null)}
      onFocus={show}
      onBlur={() => setBox(null)}
    >
      <Image
        src={src}
        alt={alt}
        width={40}
        height={40}
        className="size-10 rounded-sm object-cover ring-1 ring-neutral-200"
        unoptimized
      />

      {box && (
        <span
          role="tooltip"
          style={{ top: box.top, left: box.left, width: SIZE }}
          className="pointer-events-none fixed z-50 block rounded-lg border border-neutral-300 bg-white p-2 shadow-2xl"
        >
          <span
            className="relative block w-full overflow-hidden rounded bg-neutral-100"
            style={{ height: SIZE - 16 }}
          >
            <Image src={src} alt="" fill sizes="340px" className="object-contain" unoptimized />
          </span>
          {caption && (
            <span className="mt-1.5 block truncate px-1 text-xs text-neutral-600">{caption}</span>
          )}
        </span>
      )}
    </span>
  );
}
