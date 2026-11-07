import { handlers } from "@/lib/auth";
import type { NextRequest } from "next/server";

const googleCookieNames = {
  state: "vitals.authjs.state.v1",
  nonce: "vitals.authjs.nonce.v1",
} as const;

function getCookieNames(request: Request): Set<string> {
  return new Set(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((cookie) => cookie.trim().split("=", 1)[0]),
  );
}

function isGoogleOAuthRequest(request: Request): boolean {
  const { pathname } = new URL(request.url);
  return (
    pathname.endsWith("/signin/google") ||
    pathname.endsWith("/callback/google")
  );
}

async function handleAuthRequest(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<Response>,
): Promise<Response> {
  if (!isGoogleOAuthRequest(request)) return handler(request);

  const { pathname } = new URL(request.url);
  const action = pathname.endsWith("/signin/google") ? "signin" : "callback";
  const cookieNames = getCookieNames(request);
  const response = await handler(request);
  const setCookie = response.headers.get("set-cookie") ?? "";

  console.info("[auth][oauth-cookie-diagnostic]", {
    action,
    provider: "google",
    requestId: request.headers.get("x-vercel-id") ?? undefined,
    stateCookieReceived: cookieNames.has(googleCookieNames.state),
    nonceCookieReceived: cookieNames.has(googleCookieNames.nonce),
    stateCookieIssued: setCookie.includes(`${googleCookieNames.state}=`),
    nonceCookieIssued: setCookie.includes(`${googleCookieNames.nonce}=`),
    legacyStateCookieReceived:
      cookieNames.has("__Secure-authjs.state") ||
      cookieNames.has("authjs.state"),
  });

  return response;
}

export async function GET(request: NextRequest) {
  return handleAuthRequest(request, handlers.GET);
}

export async function POST(request: NextRequest) {
  return handleAuthRequest(request, handlers.POST);
}
