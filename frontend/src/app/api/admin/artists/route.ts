import {isSameOrigin} from "@/lib/site-config";
import { NextResponse } from "next/server";
import { applyCanonicalArtist, artistReview, type MergeRequest } from "@/lib/inventory/artists";
import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(artistReview());
}

export async function POST(request: Request) {
  if(!isSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  try {
    const body = (await request.json()) as MergeRequest;
    const result = applyCanonicalArtist(body);
    const kept = [body.canonical?.artist_first, body.canonical?.artist_last]
      .filter(Boolean)
      .join(" ");
    record({
      actor: await currentActor(),
      action: "unificar artista",
      entity: "artista",
      entityId: kept,
      summary: `"${kept}" adoptado en ${result.updated} obra(s)`,
      changes: body.variants
        .filter((variant) => [variant.artist_first, variant.artist_last].filter(Boolean).join(" ") !== kept)
        .map((variant) => ({
          field: "artist",
          label: "Grafía",
          before: [variant.artist_first, variant.artist_last].filter(Boolean).join(" "),
          after: kept,
        })),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
