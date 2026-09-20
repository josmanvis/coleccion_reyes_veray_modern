import { NextResponse } from "next/server";
import { getArtwork, updateArtwork } from "@/lib/inventory/db";
import {
  IN_INVENTORY_STATUS,
  deaccessionStatus,
  isForSale,
  withForSale,
} from "@/lib/inventory/fields";

export const dynamic = "force-dynamic";

/** The path segment is a `ref` (unique per row), not a registro number. */
type Context = { params: Promise<{ registro: string }> };

export type ArtworkAction = "for_sale" | "deaccession" | "reinstate";

/**
 * Single-field state changes that the UI exposes as one click. They live here
 * rather than in the edit form so the rules — how a "Ventas" cell is rewritten,
 * what a de-accession status reads like — stay on the server.
 */
export async function POST(request: Request, { params }: Context) {
  const { registro: ref } = await params;

  try {
    const body = (await request.json()) as {
      action?: ArtworkAction;
      value?: boolean;
      note?: string;
    };

    const current = getArtwork(ref);
    if (!current) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    let patch: Record<string, unknown>;
    switch (body.action) {
      case "for_sale": {
        // Explicit value, so two rapid clicks cannot race into the wrong state.
        const next = typeof body.value === "boolean" ? body.value : !isForSale(current.sales);
        patch = { sales: withForSale(current.sales, next) };
        break;
      }
      case "deaccession":
        patch = { status: deaccessionStatus(body.note) };
        break;
      case "reinstate":
        patch = { status: IN_INVENTORY_STATUS };
        break;
      default:
        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
    }

    const updated = updateArtwork(ref, patch);
    if (!updated) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    return NextResponse.json({
      ...updated,
      for_sale: isForSale(updated.sales),
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
