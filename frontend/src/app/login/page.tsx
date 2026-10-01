import LoginForm from "@/components/inventory/LoginForm";
import { getTr } from "@/lib/i18n-server";

export async function generateMetadata() {
  const tr = await getTr();
  return { title: tr("Acceso · Colección Reyes-Veray") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const tr = await getTr();
  const { next } = await searchParams;
  const configured = Boolean(process.env.INVENTORY_PASSWORD);

  return (
    <main className="admin-shell flex min-h-screen items-center justify-center bg-[var(--surface)] px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl leading-tight">{tr("Colección Reyes-Veray")}</h1>
        <p className="mt-1 text-sm text-[var(--ink-3)]">{tr("Acceso al inventario")}</p>

        {configured ? (
          <LoginForm next={next && next.startsWith("/") ? next : "/inventory"} />
        ) : (
          <p className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {tr("Falta definir INVENTORY_PASSWORD en el archivo .env.local y reiniciar el servidor.")}
          </p>
        )}
      </div>
    </main>
  );
}
