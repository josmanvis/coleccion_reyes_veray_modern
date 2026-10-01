import { NextResponse } from "next/server";
import { omniSearch } from "@/lib/inventory/omnisearch";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return NextResponse.json(omniSearch(searchParams.get("q") ?? ""));
}
