import {isSameOrigin} from "@/lib/site-config";
import { NextResponse } from "next/server";
import { deletePage, getPageBySlug, updatePage } from "@/lib/inventory/pages";
import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { slug } = await params;
  const page = getPageBySlug(slug);
  if (!page) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json(page);
}

export async function PATCH(request: Request, { params }: Context) {
  if(!isSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
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
  if(!isSameOrigin(_request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  const { slug } = await params;
  const actor = await currentActor();
  const page = getPageBySlug(slug);
  const trashId = deletePage(slug, actor);
  if (!trashId) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  record({
    actor,
    action: "eliminar",
    entity: "pagina",
    entityId: slug,
    summary: `Página «${page?.title ?? slug}» enviada a la papelera`,
  });
  return NextResponse.json({ ok: true, trashId });
}
