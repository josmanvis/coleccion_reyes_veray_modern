import {isSameOrigin} from "@/lib/site-config";
import { NextResponse } from "next/server";
import { deleteMedia, listMedia } from "@/lib/inventory/pages";
import { currentActor } from "@/lib/inventory/actor";
import { storeUpload } from "@/lib/inventory/uploads";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ media: listMedia() });
}

export async function POST(request: Request) {
  if(!isSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  try {
    const form = await request.formData();
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "No se recibió ninguna imagen" }, { status: 400 });
    }

    const alt = typeof form.get("alt") === "string" ? String(form.get("alt")) : null;
    const uploaded = [];
    for (const file of files) uploaded.push(await storeUpload(file, alt));

    return NextResponse.json({ media: uploaded }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if(!isSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  }

  const trashId = deleteMedia(id, await currentActor());
  if (!trashId) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true, trashId });
}
