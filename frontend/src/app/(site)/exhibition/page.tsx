import PageBlocks from "@/components/PageBlocks";
import ExhibitionFallback from "@/components/ExhibitionFallback";
import { getSitePage } from "@/lib/site-content";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const revalidate = 3600;

export async function generateMetadata() {
  const locale = await getLocale();
  return {
    title: `${t(locale, "nav.exhibition")} | Colección Reyes-Veray`,
    description: t(locale, "exhibition.metaDescription"),
  };
}

export default async function Exhibition() {
  const locale = await getLocale();
  const page = await getSitePage("exhibition");

  if (page && page.blocks && page.blocks.length > 0) {
    return <PageBlocks page={page} />;
  }

  return <ExhibitionFallback locale={locale} />;
}
