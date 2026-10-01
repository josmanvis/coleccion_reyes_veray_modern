import { NextResponse } from "next/server";
import { parseWorkbook } from "@/lib/inventory/import";
import { stageImport } from "@/lib/inventory/import-staging";

export const dynamic = "force-dynamic";

/** Parses the spreadsheet and stages a proposal. Writes nothing to the records. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Adjunta un archivo .xlsx" }, { status: 400 });
  }

  try {
    const parsed = await parseWorkbook(await file.arrayBuffer());
    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: parsed.errors[0] }, { status: 400 });
    }
    const session = stageImport(file.name, parsed);
    return NextResponse.json({
      session,
      read: parsed.rows.length,
      skipped: parsed.skipped,
      unknownColumns: parsed.unknownColumns,
      missingColumns: parsed.missingColumns,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
