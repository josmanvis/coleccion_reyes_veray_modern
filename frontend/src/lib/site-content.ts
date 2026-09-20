import { getPublishedPage } from "@/lib/inventory/pages";
import { getPage as getRemotePage, type MacPage } from "@/lib/mac";

/**
 * Resolves a content page for the public site.
 *
 * The local CMS wins: anything published from the admin is what visitors see.
 * The remote API stays as a fallback so pages that were never brought into the
 * CMS keep rendering instead of disappearing.
 */
export async function getSitePage(slug: string): Promise<MacPage | null> {
  const local = getPublishedPage(slug);
  if (local) {
    return {
      title: local.title,
      slug: local.slug,
      description: local.description,
      metaTitle: local.meta_title,
      metaDescription: local.meta_description,
      ogImage: local.og_image,
      isHomepage: false,
      blocks: local.blocks.map((block) => ({
        type: block.type,
        content: block.content,
        settings: null,
      })),
    };
  }

  return getRemotePage(slug);
}
