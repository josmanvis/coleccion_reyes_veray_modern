import { NextResponse } from "next/server";
import { submitInquiry } from "@/lib/mac";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, message, artworkTitle, artworkSlug, artworkImage, source, submissionId } = body || {};

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    if (submissionId !== undefined && (typeof submissionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId))) {
      return NextResponse.json({error: "Invalid submission identifier"}, {status:400});
    }
    const ok = await submitInquiry({
      submissionId,
      name: typeof name === "string" ? name : undefined,
      email,
      phone: typeof phone === "string" ? phone : undefined,
      message: typeof message === "string" ? message : undefined,
      artworkTitle: typeof artworkTitle === "string" ? artworkTitle : undefined,
      artworkSlug: typeof artworkSlug === "string" ? artworkSlug : undefined,
      artworkImage: typeof artworkImage === "string" ? artworkImage : undefined,
      source: typeof source === "string" ? source : "coleccion-website",
    });

    if (!ok) {
      return NextResponse.json({ error: "Could not submit inquiry" }, { status: 502 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}