import { NextResponse } from "next/server";
import { deleteArtwork, getArtwork, updateArtwork } from "@/lib/inventory/db";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ registro: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { registro } = await params;
  const artwork = getArtwork(registro);
  if (!artwork) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(artwork);
}

export async function PATCH(request: Request, { params }: Context) {
  const { registro } = await params;
  try {
    const patch = await request.json();
    const updated = updateArtwork(registro, patch);
    if (!updated) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { registro } = await params;
  if (!deleteArtwork(registro)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
