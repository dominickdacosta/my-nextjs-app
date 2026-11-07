import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { stravaIsConfigured } from "@/lib/health/strava";

export const GET = withUser(async (request) => {
  if (!stravaIsConfigured()) {
    return NextResponse.json(
      { error: "Strava integration is not configured for this deployment." },
      { status: 503 },
    );
  }
  const state = randomBytes(32).toString("base64url");
  const authorizationUrl = new URL("https://www.strava.com/oauth/authorize");
  authorizationUrl.search = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID ?? "",
    redirect_uri: process.env.STRAVA_REDIRECT_URI ?? "",
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state,
  }).toString();

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set("strava_oauth_state", state, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/api/strava/callback",
    maxAge: 600,
  });
  return response;
});
