import { NextResponse } from "next/server";
import { addMarketSale, deleteMarketSale, setHot, type HotSetting } from "@/lib/inventory/market";
import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";

export const dynamic = "force-dynamic";

/** Recorded market sales and the per-artist "hot commodity" setting. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actor = await currentActor();
    const log = (summary: string, entityId: string) =>
      record({ actor, action: String(body.action).replace(/_/g, " "), entity: "mercado", entityId, summary });

    switch (body.action) {
      case "add_sale": {
        const sale = addMarketSale(body, actor);
        log(
          `Venta de mercado · ${sale.artist_name || sale.artist_key} · $${sale.price.toLocaleString("en-US")} · ${sale.sale_date}`,
          String(sale.id)
        );
        return NextResponse.json(sale, { status: 201 });
      }
      case "delete_sale": {
        const trashId = deleteMarketSale(Number(body.id), actor);
        if (trashId) log(`Venta de mercado ${body.id} enviada a la papelera`, String(body.id));
        return NextResponse.json({ ok: Boolean(trashId), trashId });
      }
      case "set_hot": {
        setHot(String(body.key), body.hot as HotSetting);
        log(`Artista en alza: ${body.hot} · ${body.name ?? body.key}`, String(body.key));
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
