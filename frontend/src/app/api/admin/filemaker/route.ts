import { NextResponse } from "next/server";
import {
  checkAppleScript,
  checkOdbc,
  listDatabases,
  openDatabase,
  readViaAppleScript,
  readViaOdbc,
  type FileMakerMode,
} from "@/lib/inventory/filemaker";
import {
  applySyncRun,
  createSyncRun,
  decide,
  discardSyncRun,
  getSyncRun,
  latestSyncRun,
  listSyncFields,
} from "@/lib/inventory/filemaker-sync";
import { isIntranetRequest } from "@/lib/inventory/network";
import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";

export const dynamic = "force-dynamic";

/**
 * FileMaker lives on the machine running CRVMGMT: AppleScript drives the copy
 * open on that desktop, and ODBC connects from it. Someone working from a
 * browser on another machine would be reaching across to operate that FileMaker
 * blind, so syncing stays where the file is.
 */
function desktopOnly(request: Request): NextResponse | null {
  if (!isIntranetRequest(request.headers.get("host"))) return null;
  return NextResponse.json(
    {
      error:
        "La sincronización con FileMaker Pro solo funciona en la computadora donde corre CRVMGMT.",
      desktopOnly: true,
    },
    { status: 403 }
  );
}

/** Status of both mechanisms, plus whatever comparison is open. */
export async function GET(request: Request) {
  const blocked = desktopOnly(request);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const connectionString = searchParams.get("connectionString") ?? undefined;

  const [applescript, odbc] = await Promise.all([checkAppleScript(), checkOdbc(connectionString)]);
  let databases: string[] = [];
  if (applescript.available) {
    databases = await listDatabases().catch(() => []);
  }

  const run = latestSyncRun();
  return NextResponse.json({
    applescript,
    odbc,
    databases,
    run,
    fields: run ? listSyncFields(run.id) : [],
  });
}

export async function POST(request: Request) {
  const blocked = desktopOnly(request);
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  if (!body?.action) {
    return NextResponse.json({ error: "Falta la acción" }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "compare": {
        const mode = (body.mode === "odbc" ? "odbc" : "applescript") as FileMakerMode;
        const records =
          mode === "applescript"
            ? await readViaAppleScript(String(body.database ?? ""))
            : await readViaOdbc(String(body.connectionString ?? ""), String(body.table ?? ""));

        if (records.length === 0) {
          return NextResponse.json({ error: "FileMaker no devolvió registros." }, { status: 400 });
        }
        const run = createSyncRun(mode, String(body.database ?? body.table ?? ""), records);
        return NextResponse.json({ run, read: records.length });
      }
      case "open": {
        const databases = await openDatabase(String(body.path ?? ""));
        return NextResponse.json({ databases });
      }
      case "decide": {
        const changed = decide(Number(body.runId), (body.ids ?? []).map(Number), body.decision);
        return NextResponse.json({ ok: true, changed, run: getSyncRun(Number(body.runId)) });
      }
      case "apply": {
        const result = await applySyncRun(Number(body.runId), {
          database: body.database,
          connectionString: body.connectionString,
          table: body.table,
        });
        record({
          actor: await currentActor(),
          action: "sincronizar",
          entity: "filemaker",
          entityId: String(body.runId),
          summary:
            `${result.inbound.applied} campo(s) desde FileMaker, ` +
            `${result.outbound.applied} hacia FileMaker` +
            (result.inbound.failed + result.outbound.failed > 0
              ? `, ${result.inbound.failed + result.outbound.failed} con error`
              : ""),
          changes: result.errors.map((error) => ({ field: "error", before: "", after: error })),
        });
        return NextResponse.json({ ...result, run: getSyncRun(Number(body.runId)) });
      }
      case "discard": {
        discardSyncRun(Number(body.runId));
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
