import { NextResponse } from "next/server";
import { deletePage, getPageBySlug, updatePage } from "@/lib/inventory/pages";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { slug } = await params;
  const page = getPageBySlug(slug);
  if (!page) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json(page);
}

export async function PATCH(request: Request, { params }: Context) {
  const { slug } = await params;
  try {
    const updated = updatePage(slug, await request.json());
    if (!updated) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { slug } = await params;
  if (!deletePage(slug)) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
