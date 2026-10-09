import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/inventory/session";
import { readSession } from "@/lib/inventory/session-server";
import {
  HOME_PATH,
  PUBLIC_SITE_ENABLED,
  isAlwaysOpen,
  isManagementPath,
} from "@/lib/site-config";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isAlwaysOpen(pathname)) return NextResponse.next();

  // With the public site off, everything that is not management lands on the
  // inventory, which in turn asks for a sign-in when there is no session.
  if (!PUBLIC_SITE_ENABLED && !isManagementPath(pathname)) {
    return NextResponse.redirect(new URL(HOME_PATH, request.url));
  }

  if (!isManagementPath(pathname)) return NextResponse.next();

  const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except build assets, so the public site can be turned off too.
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
