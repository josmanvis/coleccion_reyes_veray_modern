import GalleryGrid from "@/components/GalleryGrid";
import { getGalleryArtworks } from "@/lib/mac";

export const revalidate = 3600; // Revalidate every hour

export default async function Gallery() {
  const artworks = await getGalleryArtworks();

  return <GalleryGrid artworks={artworks} />;
}
