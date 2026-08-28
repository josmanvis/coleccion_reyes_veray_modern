import { notFound } from "next/navigation";
import Image from "next/image";
import { getImageUrl } from "@/lib/getImageUrl";
import { getArtwork } from "@/lib/mac";
import ShareButton from "@/components/ShareButton";
import AcquireButton from "@/components/AcquireButton";
import Link from "next/link";
import InteractiveCanvas from "./InteractiveCanvas";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const artwork = await getArtwork(resolvedParams.slug);

  if (!artwork) return {};

  const imageUrl = artwork.images[0] ? getImageUrl(artwork.images[0]) : artwork.ut_high || "";
  const title = `${artwork.title} | Colección Reyes-Veray`;
  const description = artwork.description?.slice(0, 160) || "Explore the Colección Reyes-Veray contemporary archive.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: artwork.title }] : [],
      siteName: "Colección Reyes-Veray",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

export default async function ArtworkDetail({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const artwork = await getArtwork(resolvedParams.slug);

  if (!artwork) {
    notFound();
  }

  const highResUrl = artwork.images[0] ? getImageUrl(artwork.images[0]) : artwork.ut_high || null;
  const slug = artwork.slug || resolvedParams.slug;

  return (
    <main className="min-h-screen bg-neutral-100 flex flex-col relative overflow-hidden">
      {/* Background Interactive Zoom Canvas */}
      <div className="absolute inset-0 z-0 overflow-hidden cursor-move">
        {highResUrl && <InteractiveCanvas src={highResUrl} alt={artwork.title} />}
      </div>

      {/* Floating UI over the canvas */}
      <div className="relative z-10 p-6 md:p-12 min-h-screen flex flex-col justify-end md:justify-between pointer-events-none">

        <div className="hidden md:flex justify-between items-start pointer-events-auto mt-24">
           <Link href="/gallery" className="font-display text-[10px] uppercase tracking-widest bg-white/50 backdrop-blur-md px-4 py-2 hover:bg-white transition-colors border border-black/10 rounded-full">
             ← Return to Gallery
           </Link>
           <div className="font-display text-[10px] uppercase tracking-widest bg-white/50 backdrop-blur-md px-4 py-2 border border-black/10 rounded-full">
             Interactive Viewing Room
           </div>
        </div>

        {/* Desktop Bottom Details Panel (Mobile padding adjusted for fixed bottom bar) */}
        <div className="bg-white/80 backdrop-blur-2xl border border-white/20 p-8 md:p-12 max-w-2xl pointer-events-auto shadow-2xl mb-32 md:mb-0">
          <header className="mb-8 md:mb-12">
            <h1 className="font-serif text-3xl md:text-5xl font-light leading-tight">{artwork.title}</h1>
            {artwork.tags && artwork.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {artwork.tags.map((tag) => (
                  <span key={tag} className="font-display text-[9px] uppercase tracking-widest text-neutral-500 border border-black/10 rounded-full px-3 py-1">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          <div className="space-y-8 border-t border-black/10 pt-8 mb-4 md:mb-12">
            <div>
              <h3 className="font-display text-[9px] uppercase tracking-[0.3em] font-bold text-neutral-400 mb-4">Provenance & Details</h3>
              <div className="font-serif text-lg leading-relaxed whitespace-pre-wrap text-neutral-700">
                {artwork.description || "Historical data pending transcription."}
              </div>
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex flex-row gap-4">
            <AcquireButton
              className="flex-1"
              artworkTitle={artwork.title}
              artworkImage={highResUrl || ""}
              artworkSlug={slug}
            />
            <ShareButton title={artwork.title} text={`View ${artwork.title} from Colección Reyes-Veray`} />
            {highResUrl && (
              <a
                href={highResUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="flex-1 group relative flex items-center justify-center py-5 border border-black hover:bg-neutral-100 transition-colors duration-500 overflow-hidden text-black"
              >
                <span className="font-display text-[10px] uppercase tracking-[0.2em] font-bold z-10">Download Hi-Res Archive</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Fixed Action Bar (Thumb Zone UX) */}
      <div className="md:hidden fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-white via-white/90 to-transparent z-50 pointer-events-none pb-8">
        <div className="flex flex-row gap-3 pointer-events-auto shadow-2xl">
          <AcquireButton
            className="flex-[2]"
            artworkTitle={artwork.title}
            artworkImage={highResUrl || ""}
            artworkSlug={slug}
          />
          <ShareButton title={artwork.title} text={`View ${artwork.title} from Colección Reyes-Veray`} />
        </div>
      </div>
    </main>
  );
}
