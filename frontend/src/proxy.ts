import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isConfigured, isValidSession } from "@/lib/inventory/auth";

export async function proxy(request: NextRequest) {
  const authorized = await isValidSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (authorized) return NextResponse.next();

  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: isConfigured()
          ? "No autorizado"
          : "Falta definir INVENTORY_PASSWORD en .env.local",
      },
      { status: 401 }
    );
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/inventory/:path*", "/admin/:path*", "/api/inventory/:path*", "/api/admin/:path*"],
};
