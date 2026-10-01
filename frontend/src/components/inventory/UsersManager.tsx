"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { BADGE, BTN, BTN_PRIMARY, CARD, FIELD, LABEL, MUTED } from "./ui";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/inventory/session";
import { useToast } from "./ToastProvider";
import ConfirmDialog from "./ConfirmDialog";

type User = {
  id: number;
  username: string;
  name: string;
  role: Role;
  active: number;
  must_change: number;
  last_login: string | null;
};

/** Generated rather than typed, so a new account never starts on a weak one. */
function suggestPassword(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, 12);
}

export default function UsersManager({
  users,
  actorRole,
  actorId,
}: {
  users: User[];
  actorRole: string;
  actorId: number;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState({ username: "", name: "", role: "staff" as Role, password: suggestPassword() });
  const [resetting, setResetting] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null);

  async function post(payload: Record<string, unknown>, done: string) {
    setPending(true);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      notify(done);
      router.refresh();
    } else {
      notify(data.error || "No se pudo completar", "error");
    }
    setPending(false);
    return response.ok;
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const password = draft.password;
    if (await post({ action: "create", ...draft }, `Usuario ${draft.username} creado`)) {
      setIssued({ username: draft.username, password });
      setDraft({ username: "", name: "", role: "staff", password: suggestPassword() });
    }
  }

  return (
    <div className="space-y-4">
      <section className={`${CARD} p-4`}>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <UserPlus size={16} strokeWidth={1.75} aria-hidden />
          Nuevo usuario
        </h2>
        <form onSubmit={create} className="mt-3 grid gap-3 sm:grid-cols-4">
          <label>
            <span className={LABEL}>Usuario</span>
            <input
              value={draft.username}
              onChange={(e) => setDraft({ ...draft, username: e.target.value })}
              placeholder="mruiz"
              className={FIELD}
            />
          </label>
          <label>
            <span className={LABEL}>Nombre</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={FIELD}
            />
          </label>
          <label>
            <span className={LABEL}>Rol</span>
            <select
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}
              className={FIELD}
            >
              {ROLES.filter((role) => role !== "superadmin" || actorRole === "superadmin").map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={LABEL}>Contraseña inicial</span>
            <div className="flex gap-1">
              <input
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                className={FIELD}
              />
              <button
                type="button"
                onClick={() => setDraft({ ...draft, password: suggestPassword() })}
                className={BTN}
                title="Generar otra"
              >
                ↻
              </button>
            </div>
          </label>
          <div className="sm:col-span-4">
            <button type="submit" disabled={pending || !draft.username} className={BTN_PRIMARY}>
              Crear usuario
            </button>
            <span className={`ml-3 text-xs ${MUTED}`}>
              Se le pedirá cambiarla la primera vez que entre.
            </span>
          </div>
        </form>

        {issued && (
          <p className="mt-3 rounded-[var(--radius)] border border-[color:var(--success)]/30 bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">
            Entrega esta contraseña a <strong>{issued.username}</strong>:{" "}
            <span className="font-mono">{issued.password}</span> — no volverá a mostrarse.
          </p>
        )}
      </section>

      <section className={CARD}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--stroke)] bg-[var(--surface-alt)] text-left text-xs font-semibold text-[var(--ink-2)]">
              <th className="px-4 py-2">Usuario</th>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Rol</th>
              <th className="px-4 py-2">Último acceso</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className={`border-b border-[var(--stroke-soft)] ${user.active ? "" : "opacity-55"}`}>
                <td className="px-4 py-2 font-mono text-xs">{user.username}</td>
                <td className="px-4 py-2">
                  {user.name}
                  {user.must_change === 1 && (
                    <span className={`ml-2 ${BADGE.warning}`}>debe cambiar contraseña</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span className={user.role === "superadmin" ? BADGE.brand : BADGE.neutral}>
                    {user.role === "superadmin" && (
                      <ShieldCheck size={12} strokeWidth={2} aria-hidden className="mr-1" />
                    )}
                    {ROLE_LABELS[user.role]}
                  </span>
                </td>
                <td className={`px-4 py-2 text-xs ${MUTED}`}>{user.last_login ?? "—"}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setResetting(user);
                        setResetPassword(suggestPassword());
                      }}
                      className={BTN}
                    >
                      <KeyRound size={14} strokeWidth={1.75} aria-hidden />
                      Restablecer
                    </button>
                    {user.role !== "superadmin" && user.id !== actorId && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          post(
                            { action: "active", id: user.id, active: !user.active },
                            user.active ? "Usuario desactivado" : "Usuario activado"
                          )
                        }
                        className={BTN}
                      >
                        {user.active ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ConfirmDialog
        open={resetting !== null}
        title={`¿Restablecer la contraseña de ${resetting?.username ?? ""}?`}
        body="La contraseña anterior deja de funcionar y se le pedirá cambiar esta la próxima vez que entre."
        detail={<>Nueva contraseña: <span className="font-mono">{resetPassword}</span></>}
        confirmLabel="Restablecer"
        pending={pending}
        onConfirm={async () => {
          if (!resetting) return;
          const ok = await post(
            { action: "reset", id: resetting.id, password: resetPassword },
            `Contraseña de ${resetting.username} restablecida`
          );
          if (ok) setIssued({ username: resetting.username, password: resetPassword });
          setResetting(null);
        }}
        onCancel={() => setResetting(null)}
      />
    </div>
  );
}
