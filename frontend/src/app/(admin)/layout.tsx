import Link from "next/link";
import LogoutButton from "@/components/inventory/LogoutButton";
import ToastProvider from "@/components/inventory/ToastProvider";

export const metadata = {
  title: "Inventario · Colección Reyes-Veray",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ToastProvider>
      <div className="admin-shell min-h-screen bg-[#fdfcfc] text-[#111]">
      <header className="sticky top-0 z-40 h-[var(--admin-header-h)] border-b border-neutral-200 bg-[#fdfcfc]/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1600px] items-center gap-6 px-5">
          <Link href="/inventory" className="font-serif text-lg leading-none tracking-tight">
            Colección Reyes-Veray
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/inventory"
              className="rounded px-3 py-1.5 text-neutral-800 transition hover:bg-neutral-100 hover:text-black"
            >
              Inventario
            </Link>
            <Link
              href="/admin"
              className="rounded px-3 py-1.5 text-neutral-800 transition hover:bg-neutral-100 hover:text-black"
            >
              Administración
            </Link>
            <Link
              href="/admin/locations"
              className="rounded px-3 py-1.5 text-neutral-700 transition hover:bg-neutral-100 hover:text-black"
            >
              Ubicaciones
            </Link>
            <Link
              href="/admin/content"
              className="rounded px-3 py-1.5 text-neutral-700 transition hover:bg-neutral-100 hover:text-black"
            >
              Contenido
            </Link>
            <Link
              href="/admin/artists"
              className="rounded px-3 py-1.5 text-neutral-800 transition hover:bg-neutral-100 hover:text-black"
            >
              Artistas
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/" className="text-neutral-600 transition hover:text-black">
              Ver sitio
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
        {children}
      </div>
    </ToastProvider>
  );
}
