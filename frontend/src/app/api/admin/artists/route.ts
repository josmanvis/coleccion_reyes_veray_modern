import { NextResponse } from "next/server";
import { applyCanonicalArtist, artistReview, type MergeRequest } from "@/lib/inventory/artists";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(artistReview());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MergeRequest;
    return NextResponse.json(applyCanonicalArtist(body));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
