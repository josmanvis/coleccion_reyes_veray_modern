import GalleryGrid from "@/components/GalleryGrid";
import { getArtworks } from "@/lib/mac";

export const revalidate = 3600; // Revalidate every hour

export default async function Gallery() {
  const artworks = await getArtworks();

  return <GalleryGrid artworks={artworks} />;
}
