import PageBlocks from "@/components/PageBlocks";
import AboutFallback from "@/components/AboutFallback";
import { getPage } from "@/lib/mac";

export const revalidate = 3600;

export const metadata = {
  title: "About | Colección Reyes-Veray",
  description: "The Colección Reyes-Veray is the private archive of architect Otto Reyes Casanova.",
};

export default async function About() {
  const page = await getPage("about");

  if (page && page.blocks && page.blocks.length > 0) {
    return <PageBlocks page={page} />;
  }

  return <AboutFallback />;
}