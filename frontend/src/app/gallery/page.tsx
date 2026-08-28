import GalleryGrid from "@/components/GalleryGrid";

export const revalidate = 3600; // Revalidate every hour

async function getArtworks() {
  try {
    const res = await fetch("https://members.axxes.club/api/v1/public/tenants/coleccion-reyes-veray/inventory", {
      next: { revalidate: 3600 }
    });
    
    if (!res.ok) {
      console.error("Failed to fetch from MAC, falling back to local JSON");
      return (await import("@/data/artworks.json")).default;
    }
    
    const macData = await res.json();
    
    // Map MAC Products schema to Frontend Artwork schema
    return macData.map((item: any) => {
      // Sort images by position if available, fallback to empty array
      const sortedImages = Array.isArray(item.images) 
        ? [...item.images].sort((a, b) => (a.position || 0) - (b.position || 0)).map(img => img.url)
        : [];
        
      return {
        title: item.name,
        url: item.metadata?.originalUrl || `/${item.slug}`,
        description: item.description,
        images: sortedImages,
      };
    });
  } catch (error) {
    console.error("Error fetching from MAC:", error);
    return (await import("@/data/artworks.json")).default;
  }
}

export default async function Gallery() {
  const artworks = await getArtworks();
  
  return <GalleryGrid artworks={artworks} />;
}
