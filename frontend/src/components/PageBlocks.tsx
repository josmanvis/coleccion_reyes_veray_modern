import Image from "next/image";
import Link from "next/link";
import { getImageUrl } from "@/lib/getImageUrl";
import type { MacPage } from "@/lib/mac";

/**
 * Renders BAC CMS page blocks in the site's editorial design language.
 * Supports the block types published from the Axxes Club page builder.
 */
export default function PageBlocks({ page }: { page: MacPage }) {
  return (
    <main className="min-h-screen pt-48 pb-32 px-6 md:px-12 lg:px-24">
      <header className="mb-32 max-w-4xl">
        <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-light tracking-tight leading-tight">
          {page.title}
        </h1>
        {page.description && (
          <p className="font-display text-[10px] uppercase tracking-[0.2em] text-neutral-400 mt-12 leading-loose max-w-md">
            {page.description}
          </p>
        )}
      </header>

      <section className="space-y-24 max-w-5xl">
        {page.blocks.map((block, i) => {
          const c = block.content as Record<string, any>;
          switch (block.type) {
            case "heading":
              return (
                <h2
                  key={i}
                  className={`font-serif font-light tracking-tight ${
                    c.level === "h1"
                      ? "text-5xl md:text-6xl"
                      : c.level === "h3"
                        ? "text-2xl md:text-3xl"
                        : "text-3xl md:text-5xl"
                  }`}
                >
                  {c.text}
                </h2>
              );
            case "text":
              return (
                <div
                  key={i}
                  className="font-serif text-xl md:text-2xl font-light leading-relaxed text-neutral-600 max-w-3xl [&_a]:underline [&_a]:underline-offset-8"
                  dangerouslySetInnerHTML={{ __html: c.html || "" }}
                />
              );
            case "image":
              return c.url ? (
                <figure key={i} className="relative aspect-[4/3] bg-neutral-100 overflow-hidden">
                  <Image
                    src={getImageUrl(c.url, true)}
                    alt={c.alt || ""}
                    fill
                    className="object-contain p-8 mix-blend-multiply"
                  />
                  {c.caption && (
                    <figcaption className="font-display text-[9px] uppercase tracking-widest text-neutral-400 mt-4">
                      {c.caption}
                    </figcaption>
                  )}
                </figure>
              ) : null;
            case "gallery":
              return (
                <div key={i} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                  {(c.images || []).map((img: any, j: number) => (
                    <figure key={j} className="relative aspect-[3/4] bg-neutral-100 overflow-hidden">
                      {img.url && (
                        <Image
                          src={getImageUrl(img.url, true)}
                          alt={img.alt || ""}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="object-contain p-8 mix-blend-multiply"
                        />
                      )}
                    </figure>
                  ))}
                </div>
              );
            case "cta":
              return c.text ? (
                <div key={i}>
                  <Link
                    href={c.link || "/gallery"}
                    className="inline-block font-display text-[10px] uppercase tracking-widest underline underline-offset-8 text-black hover:text-neutral-400 transition-colors"
                  >
                    {c.text}
                  </Link>
                </div>
              ) : null;
            case "divider":
              return <hr key={i} className="border-black/10" />;
            case "spacer":
              return <div key={i} style={{ height: `${c.height || 40}px` }} />;
            default:
              return null;
          }
        })}
      </section>
    </main>
  );
}