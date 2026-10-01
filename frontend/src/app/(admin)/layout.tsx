import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import LogoutButton from "@/components/inventory/LogoutButton";
import OmniSearch from "@/components/inventory/OmniSearch";
import NavRail from "@/components/inventory/NavRail";
import ToastProvider from "@/components/inventory/ToastProvider";
import { PUBLIC_SITE_ENABLED } from "@/lib/site-config";
import DesktopChrome from "@/components/inventory/DesktopChrome";
import PresenceBar from "@/components/inventory/PresenceBar";
import ClockButton from "@/components/inventory/ClockButton";
import { SESSION_COOKIE, readSession } from "@/lib/inventory/session";
import { getUser } from "@/lib/inventory/users";
import { accentStyle } from "@/lib/inventory/theme";
import { getTr } from "@/lib/i18n-server";

export async function generateMetadata() {
  const tr = await getTr();
  return { title: tr("Inventario · Colección Reyes-Veray") };
}

/**
 * Microsoft 365 shell: a slim brand bar across the top, a navigation rail down
 * the left, and the working surface on a light canvas. Each page supplies its
 * own command bar beneath the header.
 */
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tr = await getTr();
  // The accent is resolved on the server and written onto the shell, so the
  // interface never flashes the default blue before the preference loads.
  const store = await cookies();
  const session = await readSession(store.get(SESSION_COOKIE)?.value);
  const user = session ? getUser(session.userId) : null;

  return (
    <div className="admin-shell min-h-screen" style={accentStyle(user?.accent)}>
      <ToastProvider>
        <DesktopChrome />
        <header className="app-drag app-bar-inset sticky top-0 z-40 flex h-[var(--admin-header-h)] items-center gap-3 bg-[var(--brand)] px-4 text-[var(--on-brand)]">
          <Link
            href="/inventory"
            className="app-no-drag flex items-center gap-2 text-sm font-semibold tracking-tight hover:underline"
          >
            {/* Monochrome mark, forced white so it reads on the brand bar. */}
            <Image
              src="/crv-mark.png"
              alt=""
              width={22}
              height={20}
              className="shrink-0 brightness-0 invert"
              priority
            />
            
            {tr("OORC")}
          </Link>
          <div className="app-no-drag mx-auto hidden w-full max-w-[520px] md:block">
            <OmniSearch />
          </div>

          <div className="app-no-drag ml-auto flex items-center gap-2">
            <PresenceBar />
            <ClockButton />
            {PUBLIC_SITE_ENABLED && (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-sm text-white/90 transition-colors hover:bg-white/15 hover:text-white"
              >
                <ExternalLink size={15} strokeWidth={1.75} aria-hidden />
                
                {tr("Ver sitio")}
              </Link>
            )}
            <LogoutButton />
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-var(--admin-header-h))]">
          <NavRail />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </ToastProvider>
    </div>
  );
}
