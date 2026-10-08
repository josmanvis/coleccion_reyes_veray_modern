import {isSameOrigin} from "@/lib/site-config";
import { NextResponse } from "next/server";
import { importWorkbook, linkWebsiteImages } from "@/lib/inventory/import";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if(!isSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
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
