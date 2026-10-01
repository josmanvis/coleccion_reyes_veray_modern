import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./ToastProvider";
import { useTr } from "@/components/I18nProvider";

/**
 * Client side of the trash. Kept free of lib/inventory values: trash.ts
 * reaches the database (see project-client-server-module-split).
 */

export async function trashAction(action: "restore" | "purge", id: number): Promise<{ href: string | null }> {
  const response = await fetch("/api/admin/trash", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, id }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "No se pudo completar");
  return { href: body.href ?? null };
}

/**
 * The toast every delete shows: what went to the trash, with "Deshacer"
 * restoring it on the spot. `onRestored` runs after a successful undo, for a
 * caller that navigated away from the deleted record.
 */
export function useDeletedToast() {
  const tr = useTr();
  const router = useRouter();
  const { notify } = useToast();

  return useCallback(
    (message: string, trashId: number | null | undefined, onRestored?: (href: string | null) => void) => {
      if (!trashId) {
        notify(message);
        return;
      }
      notify(message, "success", {
        label: tr("Deshacer"),
        run: async () => {
          try {
            const { href } = await trashAction("restore", trashId);
            notify(tr("Restaurado desde la papelera"));
            if (onRestored) onRestored(href);
            router.refresh();
          } catch (error) {
            notify(tr((error as Error).message), "error");
          }
        },
      });
    },
    [notify, router, tr]
  );
}
