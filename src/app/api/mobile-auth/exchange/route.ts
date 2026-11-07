import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { sessions, verificationTokens } from "@/lib/db/schema";
import {
  hashMobileHandoffCode,
  isValidMobileHandoff,
  verifyMobileHandoffCode,
} from "@/lib/auth/mobile-handoff";
import { logMobileHandoffDiagnostic } from "@/lib/auth/mobile-handoff-diagnostics";
import { z } from "zod";

export const runtime = "nodejs";

const exchangeSchema = z.object({
  code: z.string().min(1).max(2048),
  handoff: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: unknown;
  try {
    const bodyText = await request.text();
    if (bodyText.length > 4096) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = exchangeSchema.safeParse(body);
  if (!parsed.success || !isValidMobileHandoff(parsed.data.handoff)) {
    return NextResponse.json({ error: "Invalid sign-in handoff." }, { status: 400 });
  }
  if (!process.env.AUTH_SECRET || !process.env.DATABASE_URL) {
    logMobileHandoffDiagnostic(request, "exchange", "not_configured");
    return NextResponse.json(
      { error: "Mobile sign-in is not configured." },
      { status: 503 },
    );
  }

  const payload = verifyMobileHandoffCode(
    parsed.data.code,
    parsed.data.handoff,
    process.env.AUTH_SECRET,
  );
  if (!payload) {
    logMobileHandoffDiagnostic(request, "exchange", "code_invalid_or_expired");
    return NextResponse.json({ error: "Sign-in handoff expired or invalid." }, { status: 401 });
  }

  const [ticket] = await getDb()
    .delete(verificationTokens)
    .where(
      and(
        eq(
          verificationTokens.identifier,
          `vitals-mobile-handoff:${parsed.data.handoff}`,
        ),
        eq(verificationTokens.token, hashMobileHandoffCode(parsed.data.code)),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .returning({ identifier: verificationTokens.identifier });
  if (!ticket) {
    logMobileHandoffDiagnostic(request, "exchange", "code_already_used_or_expired");
    return NextResponse.json({ error: "Sign-in handoff already used or expired." }, { status: 401 });
  }

  const sessionToken = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + sessionLifetimeMs);
  await getDb().insert(sessions).values({
    sessionToken,
    userId: payload.userId,
    expires,
  });

  const secure = process.env.NODE_ENV === "production";
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: `${secure ? "__Secure-" : ""}authjs.session-token`,
    value: sessionToken,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires,
  });
  logMobileHandoffDiagnostic(request, "exchange", "session_created");
  return response;
}
