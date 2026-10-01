"use client";

const widths = [320, 640, 960, 1600];
/** Variants are prepared once on upload; Cloud Run never resizes them. */
export default function imageLoader({src, width}: {src: string; width: number; quality?: number}): string {
  const clean = src.split("?")[0];
  if (!clean.startsWith("https://storage.googleapis.com/gravy-meta-orc-web/v1/")) return src;
  const selected = widths.find(size => size >= width) ?? widths[widths.length - 1];
  return `${clean.replace(/\.w\d+\.webp$/, "")}.w${selected}.webp`;
}
