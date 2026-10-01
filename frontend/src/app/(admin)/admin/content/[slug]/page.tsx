import Link from "next/link";
import { notFound } from "next/navigation";
import { getPageBySlug } from "@/lib/inventory/pages";
import PageEditor from "@/components/inventory/PageEditor";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const page = getPageBySlug(slug);
  return { title: page ? `${page.title} · Contenido` : "No encontrada" };
}

export default async function EditPage({ params }: Props) {
  const { slug } = await params;
  const page = getPageBySlug(slug);
  if (!page) notFound();

  return (
    <main className="mx-auto max-w-[1100px] px-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <p className="font-mono text-xs text-[var(--ink-3)]">/{page.slug}</p>
          <h1 className="text-2xl leading-tight">{page.title}</h1>
        </div>
        <Link
          href="/admin/content"
          className="rounded border border-[var(--stroke)] px-3 py-2 text-sm font-medium text-[var(--ink-2)] transition hover:bg-[var(--hover)]"
        >
          Todas las páginas
        </Link>
      </div>

      <PageEditor page={page} />
    </main>
  );
}
