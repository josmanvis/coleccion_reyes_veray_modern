import { NextResponse } from "next/server";
import { listArtworks } from "@/lib/inventory/db";
import { parseListParams } from "@/lib/inventory/params";
import { toCsv, toWebsiteArtwork } from "@/lib/inventory/export";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/export?format=json|csv&shape=full|website
 * Honours the same filters as /inventory, so you can export exactly what you
 * are looking at. The "website" shape is what the public site consumes.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "json";
  const shape = searchParams.get("shape") === "website" ? "website" : "full";

  const params = parseListParams(searchParams);
  if (shape === "website" && !params.statusGroup) params.statusGroup = "en_inventario";

  const all = [];
  for (let page = 1; ; page++) {
    const { rows, pages } = listArtworks({ ...params, page, limit: 500 });
    all.push(...rows);
    if (page >= pages) break;
  }
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    return new NextResponse(toCsv(all), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventario-${stamp}.csv"`,
      },
    });
  }

  const payload = shape === "website" ? all.map(toWebsiteArtwork) : all;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventario-${shape}-${stamp}.json"`,
    },
  });
}
