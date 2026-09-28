import type { Metadata } from "next";
import ArtistsIndex from "@/components/ArtistsIndex";
import { getArtists } from "@/lib/mac";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Índice | Colección Reyes-Veray",
  description: "Artists represented in the Colección Reyes-Veray, A–Z.",
};

export default async function Index() {
  const artists = await getArtists();
  return <ArtistsIndex artists={artists} />;
}
