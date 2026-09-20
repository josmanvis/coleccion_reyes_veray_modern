/**
 * Shapes and helpers for CMS content blocks.
 *
 * Kept free of any database import so the block editor — a client component —
 * can use them. Pulling these from `pages.ts` would drag better-sqlite3 into the
 * browser bundle, which fails the build outright.
 */

export type BlockType = "heading" | "text" | "image" | "gallery" | "cta" | "divider" | "spacer";

export type Block = {
  type: BlockType;
  content: Record<string, unknown>;
};

export type PageStatus = "draft" | "published";

export type PageRow = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  status: PageStatus;
  blocks: Block[];
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  nav_label: string | null;
  nav_order: number | null;
  created_at: string;
  updated_at: string;
};

export type MediaRow = {
  id: number;
  filename: string;
  url: string;
  mime: string | null;
  bytes: number | null;
  alt: string | null;
  created_at: string;
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Encabezado",
  text: "Texto",
  image: "Imagen",
  gallery: "Galería",
  cta: "Enlace destacado",
  divider: "Separador",
  spacer: "Espacio",
};

/** A new block of each type, with the fields `PageBlocks` expects. */
export function emptyBlock(type: BlockType): Block {
  switch (type) {
    case "heading":
      return { type, content: { level: "h2", text: "" } };
    case "text":
      return { type, content: { html: "" } };
    case "image":
      return { type, content: { url: "", alt: "", caption: "" } };
    case "gallery":
      return { type, content: { images: [] } };
    case "cta":
      return { type, content: { text: "", link: "" } };
    case "spacer":
      return { type, content: { height: 40 } };
    default:
      return { type, content: {} };
  }
}

export function slugifyPage(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
