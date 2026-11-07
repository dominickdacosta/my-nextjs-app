import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { stravaConnections } from "@/lib/db/schema";
import {
  encryptStravaToken,
  exchangeStravaCode,
  stravaIsConfigured,
} from "@/lib/health/strava";

function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  const value = cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return value ? decodeURIComponent(value) : null;
}

function callbackResponse(request: Request, status: string) {
  const response = NextResponse.redirect(
    new URL(`/train?strava=${status}`, request.url),
  );
  response.cookies.set("strava_oauth_state", "", {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/api/strava/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const url = new URL(request.url);
  const returnedState = url.searchParams.get("state");
  const savedState = cookieValue(request, "strava_oauth_state");
  if (!userId || !returnedState || !savedState || returnedState !== savedState) {
    return callbackResponse(request, "error");
  }
  if (url.searchParams.get("error")) {
    return callbackResponse(request, "cancelled");
  }
  const code = url.searchParams.get("code");
  if (!code || !stravaIsConfigured()) {
    return callbackResponse(request, "error");
  }

  try {
    const tokens = await exchangeStravaCode(code);
    if (!tokens.athlete?.id) {
      return callbackResponse(request, "error");
    }
    await getDb()
      .insert(stravaConnections)
      .values({
        userId,
        athleteId: String(tokens.athlete.id),
        accessTokenEncrypted: encryptStravaToken(tokens.access_token),
        refreshTokenEncrypted: encryptStravaToken(tokens.refresh_token),
        expiresAt: tokens.expires_at,
        scope: "read,activity:read_all",
      })
      .onConflictDoUpdate({
        target: stravaConnections.userId,
        set: {
          athleteId: String(tokens.athlete.id),
          accessTokenEncrypted: encryptStravaToken(tokens.access_token),
          refreshTokenEncrypted: encryptStravaToken(tokens.refresh_token),
          expiresAt: tokens.expires_at,
          scope: "read,activity:read_all",
          updatedAt: new Date(),
        },
      });
    return callbackResponse(request, "connected");
  } catch {
    return callbackResponse(request, "error");
  }
}
