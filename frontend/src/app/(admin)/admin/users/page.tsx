import { cookies } from "next/headers";
import { SESSION_COOKIE, canManageUsers, readSession } from "@/lib/inventory/session";
import { listUsers } from "@/lib/inventory/users";
import { CARD, MUTED } from "@/components/inventory/ui";
import UsersManager from "@/components/inventory/UsersManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usuarios · CRVMGMT" };

export default async function UsersPage() {
  const store = await cookies();
  const session = await readSession(store.get(SESSION_COOKIE)?.value);
  const allowed = session ? canManageUsers(session.role) : false;

  return (
    <>
      <div className="border-b border-[var(--stroke-soft)] bg-[var(--surface)]">
        <div className="px-6 py-3">
          <h1 className="text-xl font-semibold leading-tight text-[var(--ink-1)]">Usuarios</h1>
          <p className={`mt-0.5 text-sm ${MUTED}`}>
            Cuentas de CRVMGMT. Las contraseñas no se guardan en texto plano: se restablecen, no se
            consultan.
          </p>
        </div>
      </div>

      <div className="px-6 py-4">
        {allowed ? (
          <UsersManager users={listUsers()} actorRole={session!.role} actorId={session!.userId} />
        ) : (
          <div className={`${CARD} p-4 text-sm ${MUTED}`}>
            Solo un administrador puede gestionar usuarios.
          </div>
        )}
      </div>
    </>
  );
}
