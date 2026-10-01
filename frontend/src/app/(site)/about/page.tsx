import PageBlocks from "@/components/PageBlocks";
import AboutFallback from "@/components/AboutFallback";
import { getSitePage } from "@/lib/site-content";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const revalidate = 3600;

export async function generateMetadata() {
  const locale = await getLocale();
  return {
    title: `${t(locale, "nav.collector")} | Colección Reyes-Veray`,
    description: t(locale, "about.metaDescription"),
  };
}

export default async function About() {
  const locale = await getLocale();
  const page = await getSitePage("about");

  if (page && page.blocks && page.blocks.length > 0) {
    return <PageBlocks page={page} />;
  }

  return <AboutFallback locale={locale} />;
}
