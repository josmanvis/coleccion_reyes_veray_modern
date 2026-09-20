import { NextResponse } from "next/server";
import { importWorkbook, linkWebsiteImages } from "@/lib/inventory/import";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Adjunta un archivo .xlsx" }, { status: 400 });
  }

  try {
    const result = await importWorkbook(await file.arrayBuffer());
    const images = await linkWebsiteImages();
    return NextResponse.json({ ...result, images, filename: file.name });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
