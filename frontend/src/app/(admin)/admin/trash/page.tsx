import { cookies } from "next/headers";
import { listTrash } from "@/lib/inventory/trash";
import { SESSION_COOKIE, canManageUsers } from "@/lib/inventory/session";
import { readSession } from "@/lib/inventory/session-server";
import TrashManager from "@/components/inventory/TrashManager";
import { PAGE } from "@/components/inventory/ui";
import { getTr } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const tr = await getTr();
  return { title: tr("Papelera · Inventario") };
}

export default async function TrashPage() {
  const tr = await getTr();
  const store = await cookies();
  const session = await readSession(store.get(SESSION_COOKIE)?.value);

  return (
    <main className={PAGE}>
      <div className="pb-5">
        <h1 className="text-3xl leading-none">{tr("Papelera")}</h1>
        <p className="mt-1.5 max-w-[75ch] text-sm text-[var(--ink-3)]">
          {tr("Todo lo que se elimina — obras, certificados, páginas, imágenes, ubicaciones y jornadas — queda aquí con sus archivos hasta que lo restaures. Restaurar lo devuelve tal como estaba.")}
        </p>
      </div>
      <TrashManager items={listTrash()} canPurge={session ? canManageUsers(session.role) : false} />
    </main>
  );
}
