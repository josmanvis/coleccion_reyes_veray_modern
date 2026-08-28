import PageBlocks from "@/components/PageBlocks";
import ExhibitionFallback from "@/components/ExhibitionFallback";
import { getPage } from "@/lib/mac";

export const revalidate = 3600;

export const metadata = {
  title: "Exhibition | Colección Reyes-Veray",
  description: "La Colección Reyes-Veray en el Museo de Arte Contemporáneo de Puerto Rico.",
};

export default async function Exhibition() {
  const page = await getPage("exhibition");

  if (page && page.blocks && page.blocks.length > 0) {
    return <PageBlocks page={page} />;
  }

  return <ExhibitionFallback />;
}