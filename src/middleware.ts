import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const isPublic =
    pathname === "/signin" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/_next/");

  if (isPublic) return NextResponse.next();

  if (!request.auth?.user?.id) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const signInUrl = new URL("/signin", request.nextUrl);
    signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(signInUrl);
  }

  if (!request.auth.user.onboarded && pathname !== "/onboarding" && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/onboarding", request.nextUrl));
  }

  if (request.auth.user.onboarded && pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
  runtime: "nodejs",
};
