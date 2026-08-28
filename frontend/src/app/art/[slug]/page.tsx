import data from "@/data/artworks.json";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getImageUrl } from "@/lib/getImageUrl";
import ShareButton from "@/components/ShareButton";
import Link from "next/link";
import InteractiveCanvas from "./InteractiveCanvas";

export async function generateStaticParams() {
  return data.slice(0, 100).map((work) => ({
    slug: work.url.replace("/", "").replace("/index.html", ""),
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const artwork = data.find((a) => a.url === `/${resolvedParams.slug}/index.html` || a.url === `/${resolvedParams.slug}`);

  if (!artwork) return {};

  const imageUrl = artwork.ut_high || getImageUrl(artwork.images[0]);
  const title = `${artwork.title} | Colección Reyes-Veray`;
  const description = "Explore the Colección Reyes-Veray contemporary archive.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: artwork.title,
        },
      ],
      siteName: "Colección Reyes-Veray",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ArtworkDetail({ params }: { params: Promise<{ slug: string }> }) {
  // Await the params since Next.js 15 might require params to be treated as a promise in some contexts,
  // but standard usage in app router allows sync destructuring if used properly, actually Next 15 requires awaiting it if it's dynamic.
  const resolvedParams = await params; 
  
  const artwork = data.find((a) => a.url === `/${resolvedParams.slug}/index.html` || a.url === `/${resolvedParams.slug}`);

  if (!artwork) {
    notFound();
  }

  const highResUrl = artwork.ut_high || getImageUrl(artwork.images[0]);

  return (
    <main className="min-h-screen bg-neutral-100 flex flex-col relative overflow-hidden">
      {/* Background Interactive Zoom Canvas */}
      <div className="absolute inset-0 z-0 overflow-hidden cursor-move">
        {highResUrl && <InteractiveCanvas src={highResUrl} alt={artwork.title} />}
      </div>

      {/* Floating UI over the canvas */}
      <div className="relative z-10 p-6 md:p-12 min-h-screen flex flex-col justify-end md:justify-between pointer-events-none">
        
        {/* Top Spacer / Back button in Header handles navigation, but we can add one here */}
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
            <button className="flex-1 group relative flex items-center justify-center py-5 border border-black bg-black text-white hover:bg-neutral-800 transition-colors duration-500 overflow-hidden">
              <span className="font-display text-[10px] uppercase tracking-[0.2em] font-bold z-10">Acquire Artwork</span>
            </button>
            <ShareButton title={artwork.title} text={`View ${artwork.title} from Colección Reyes-Veray`} />
            {highResUrl && (
              <a 
                href={highResUrl} 
                download
                target="_blank"
                rel="noreferrer"
                className="flex-1 group relative flex items-center justify-center py-5 border border-black hover:bg-neutral-100 transition-colors duration-500 overflow-hidden"
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
          <button className="flex-[2] group relative flex items-center justify-center py-5 border border-black bg-black text-white active:bg-neutral-800 transition-colors duration-300">
            <span className="font-display text-[11px] uppercase tracking-[0.2em] font-bold">Acquire</span>
          </button>
          <ShareButton title={artwork.title} text={`View ${artwork.title} from Colección Reyes-Veray`} />
        </div>
      </div>
    </main>
  );
}
