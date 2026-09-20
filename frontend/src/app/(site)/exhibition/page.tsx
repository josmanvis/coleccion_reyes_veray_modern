import PageBlocks from "@/components/PageBlocks";
import ExhibitionFallback from "@/components/ExhibitionFallback";
import { getSitePage } from "@/lib/site-content";

export const revalidate = 3600;

export const metadata = {
  title: "Exhibition | Colección Reyes-Veray",
  description: "La Colección Reyes-Veray en el Museo de Arte Contemporáneo de Puerto Rico.",
};

export default async function Exhibition() {
  const page = await getSitePage("exhibition");

  if (page && page.blocks && page.blocks.length > 0) {
    return <PageBlocks page={page} />;
  }

  return <ExhibitionFallback />;
}