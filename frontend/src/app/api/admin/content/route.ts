import { NextResponse } from "next/server";
import { createPage, listPages } from "@/lib/inventory/pages";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ pages: listPages() });
}

export async function POST(request: Request) {
  try {
    return NextResponse.json(createPage(await request.json()), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
