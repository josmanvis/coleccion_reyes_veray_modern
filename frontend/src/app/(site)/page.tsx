import HomeShowcase from "@/components/HomeShowcase";
import { getFeaturedArtworks } from "@/lib/mac";

export const revalidate = 3600; // Revalidate every hour

export default async function Home() {
  const featured = await getFeaturedArtworks(2);

  return <HomeShowcase featured={featured} />;
}
