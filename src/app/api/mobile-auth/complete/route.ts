import { and, like, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { verificationTokens } from "@/lib/db/schema";
import {
  createMobileHandoffCode,
  hashMobileHandoffCode,
  isValidMobileHandoff,
} from "@/lib/auth/mobile-handoff";
import { logMobileHandoffDiagnostic } from "@/lib/auth/mobile-handoff-diagnostics";

export const runtime = "nodejs";

const handoffIdentifier = "vitals-mobile-handoff:";
const handoffLifetimeMs = 2 * 60 * 1000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const handoff = url.searchParams.get("handoff") ?? "";
  const session = await auth();
  const appCallback = new URL("com.vitals.health://auth/callback");
  appCallback.searchParams.set("handoff", handoff);

  if (!isValidMobileHandoff(handoff)) {
    return NextResponse.json({ error: "Invalid sign-in handoff." }, { status: 400 });
  }
  if (!session?.user?.id) {
    logMobileHandoffDiagnostic(request, "complete", "session_missing");
    appCallback.searchParams.set("error", "sign_in_required");
    return NextResponse.redirect(appCallback);
  }
  if (!process.env.AUTH_SECRET || !process.env.DATABASE_URL) {
    logMobileHandoffDiagnostic(request, "complete", "not_configured");
    return NextResponse.json(
      { error: "Mobile sign-in is not configured." },
      { status: 503 },
    );
  }

  const expiresAt = Date.now() + handoffLifetimeMs;
  const code = createMobileHandoffCode(
    { userId: session.user.id, handoff, expiresAt },
    process.env.AUTH_SECRET,
  );
  const db = getDb();
  await db
    .delete(verificationTokens)
    .where(
      and(
        like(verificationTokens.identifier, `${handoffIdentifier}%`),
        lt(verificationTokens.expires, new Date()),
      ),
    );
  await db.insert(verificationTokens).values({
    identifier: `${handoffIdentifier}${handoff}`,
    token: hashMobileHandoffCode(code),
    expires: new Date(expiresAt),
  });

  appCallback.searchParams.set("code", code);
  logMobileHandoffDiagnostic(request, "complete", "handoff_created");
  const response = NextResponse.redirect(appCallback);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
