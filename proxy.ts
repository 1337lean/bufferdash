import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "bufferdash_session";
const protectedPrefixes = ["/dashboard", "/sites", "/live", "/security", "/server", "/logs", "/settings", "/api/admin"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedPath = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!protectedPath) return NextResponse.next();

  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/sites/:path*", "/live/:path*", "/security/:path*", "/server/:path*", "/logs/:path*", "/settings/:path*", "/api/admin/:path*"]
};
