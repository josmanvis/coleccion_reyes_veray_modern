import HomeShowcase from "@/components/HomeShowcase";
import { getFeaturedArtworks } from "@/lib/mac";
import { getLocale } from "@/lib/i18n-server";

export const revalidate = 3600; // Revalidate every hour

export default async function Home() {
  const featured = await getFeaturedArtworks(2);

  return <HomeShowcase featured={featured} locale={await getLocale()} />;
}
