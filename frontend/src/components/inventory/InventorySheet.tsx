"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import DataSheet, { type SheetChange, type SheetColumn, type SheetRow, type SheetSaveResult } from "./DataSheet";

/** The inventory as a spreadsheet; saves go through the bulk PATCH on /api/inventory. */
export default function InventorySheet({ columns, rows }: { columns: SheetColumn[]; rows: SheetRow[] }) {
  const router = useRouter();

  const onSave = useCallback(
    async (changes: SheetChange[]): Promise<SheetSaveResult> => {
      const response = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: changes.map(({ id, patch }) => ({ ref: id, patch })) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo guardar");

      const saved: SheetSaveResult["saved"] = {};
      for (const [ref, row] of Object.entries(body.saved as Record<string, Record<string, unknown>>)) {
        saved[ref] = Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, value === null || value === undefined ? "" : String(value)])
        );
      }
      router.refresh();
      return { saved, failed: body.failed ?? {} };
    },
    [router]
  );

  return <DataSheet storageKey="inventory" columns={columns} rows={rows} onSave={onSave} />;
}
