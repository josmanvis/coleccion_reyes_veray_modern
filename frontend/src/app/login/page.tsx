import LoginForm from "@/components/inventory/LoginForm";

export const metadata = { title: "Acceso · Colección Reyes-Veray" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const configured = Boolean(process.env.INVENTORY_PASSWORD);

  return (
    <main className="admin-shell flex min-h-screen items-center justify-center bg-[var(--surface)] px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl leading-tight">Colección Reyes-Veray</h1>
        <p className="mt-1 text-sm text-[var(--ink-3)]">Acceso al inventario</p>

        {configured ? (
          <LoginForm next={next && next.startsWith("/") ? next : "/inventory"} />
        ) : (
          <p className="mt-8 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Falta definir <code className="font-mono">INVENTORY_PASSWORD</code> en el archivo{" "}
            <code className="font-mono">.env.local</code> y reiniciar el servidor.
          </p>
        )}
      </div>
    </main>
  );
}
