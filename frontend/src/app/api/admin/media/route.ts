import { NextResponse } from "next/server";
import { deleteMediaRecord, getMedia, listMedia } from "@/lib/inventory/pages";
import { removeUploadFile, storeUpload } from "@/lib/inventory/uploads";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ media: listMedia() });
}

export async function POST(request: Request) {
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
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  }

  const entry = getMedia(id);
  if (!entry) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  await removeUploadFile(entry.filename);
  deleteMediaRecord(id);
  return NextResponse.json({ ok: true });
}
