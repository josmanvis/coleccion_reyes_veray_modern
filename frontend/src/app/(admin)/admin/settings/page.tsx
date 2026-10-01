import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, canManageUsers, readSession } from "@/lib/inventory/session";
import { readSettings } from "@/lib/inventory/settings";
import { getUser } from "@/lib/inventory/users";
import { databasePath } from "@/lib/inventory/db";
import { MUTED } from "@/components/inventory/ui";
import SettingsForm from "@/components/inventory/SettingsForm";
import AppearanceCard from "@/components/inventory/AppearanceCard";
import LanguageCard from "@/components/inventory/LanguageCard";
import { getLocale } from "@/lib/i18n-server";
import { getTr } from "@/lib/i18n-server";
import { networkAddresses, portOf } from "@/lib/inventory/lan";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const tr = await getTr();
  return { title: tr("Ajustes · CRVMGMT") };
}

export default async function SettingsPage() {
  const tr = await getTr();
  const store = await cookies();
  const host = (await headers()).get("host") ?? "";
  const port = portOf(host);
  const session = await readSession(store.get(SESSION_COOKIE)?.value);
  const user = session ? getUser(session.userId) : null;
  const locale = await getLocale();

  return (
    <>
      <div className="border-b border-[var(--stroke-soft)] bg-[var(--surface)]">
        <div className="px-6 py-3">
          <h1 className="text-xl font-semibold leading-tight text-[var(--ink-1)]">{tr("Ajustes")}</h1>
          <p className={`mt-0.5 text-sm ${MUTED}`}>
            {session && canManageUsers(session.role)
              ? tr("Preferencias de CRVMGMT y de tu cuenta.")
              : tr("Tu cuenta. Los ajustes generales los cambia un administrador.")}
          </p>
        </div>
      </div>

      <div className="space-y-4 px-6 py-4">
        {user && (
          <AppearanceCard name={user.name} accent={user.accent} avatar={user.avatar} />
        )}

        <LanguageCard currentLocale={locale} />

        <SettingsForm
          initial={readSettings()}
          canEdit={session ? canManageUsers(session.role) : false}
          mustChange={user?.must_change === 1}
          dataDirectory={databasePath()}
          networkAddresses={networkAddresses(port)}
        />
      </div>
    </>
  );
}
