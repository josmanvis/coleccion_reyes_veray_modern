import { NextResponse } from "next/server";
import { createArtwork, facets, listArtworks } from "@/lib/inventory/db";
import { parseListParams } from "@/lib/inventory/params";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = listArtworks(parseListParams(searchParams));
  return NextResponse.json(
    searchParams.get("facets") === "1" ? { ...result, facets: facets() } : result
  );
}

export async function POST(request: Request) {
  try {
    const values = await request.json();
    return NextResponse.json(createArtwork(values), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
