import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { stravaConnections } from "@/lib/db/schema";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_at: z.number().int().positive(),
  athlete: z.object({ id: z.number().int().positive() }).optional(),
});

export class StravaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StravaError";
  }
}

export function stravaIsConfigured(): boolean {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
  const redirectUri = process.env.STRAVA_REDIRECT_URI?.trim();
  const encodedKey = process.env.STRAVA_TOKEN_ENCRYPTION_KEY?.trim();
  if (!clientId || !clientSecret || !redirectUri || !encodedKey) return false;

  try {
    const redirectUrl = new URL(redirectUri);
    return (
      (redirectUrl.protocol === "https:" || redirectUrl.protocol === "http:") &&
      Buffer.from(encodedKey, "base64").length === 32
    );
  } catch {
    return false;
  }
}

function encryptionKey(): Buffer {
  const encoded = process.env.STRAVA_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new StravaError("Strava token encryption is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new StravaError("Strava token encryption configuration is invalid.");
  }
  return key;
}

export function encryptStravaToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptStravaToken(value: string): string {
  const [encodedIv, encodedTag, encodedData] = value.split(".");
  if (!encodedIv || !encodedTag || !encodedData) {
    throw new StravaError("Stored Strava credentials are invalid.");
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(encodedIv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedData, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new StravaError("Could not decrypt Strava credentials.");
  }
}

export async function exchangeStravaCode(code: string) {
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID ?? "",
      client_secret: process.env.STRAVA_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new StravaError("Strava authorization could not be completed.");
  const parsed = tokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new StravaError("Strava returned an invalid authorization response.");
  return parsed.data;
}

export async function stravaAccessToken(userId: string): Promise<string | null> {
  const [connection] = await getDb()
    .select()
    .from(stravaConnections)
    .where(eq(stravaConnections.userId, userId))
    .limit(1);
  if (!connection) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (connection.expiresAt > nowSeconds + 60) {
    return decryptStravaToken(connection.accessTokenEncrypted);
  }

  const refreshToken = decryptStravaToken(connection.refreshTokenEncrypted);
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID ?? "",
      client_secret: process.env.STRAVA_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new StravaError("Strava authorization expired; reconnect the account.");
  const parsed = tokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new StravaError("Strava returned an invalid refresh response.");

  await getDb()
    .update(stravaConnections)
    .set({
      accessTokenEncrypted: encryptStravaToken(parsed.data.access_token),
      refreshTokenEncrypted: encryptStravaToken(parsed.data.refresh_token),
      expiresAt: parsed.data.expires_at,
      updatedAt: new Date(),
    })
    .where(and(eq(stravaConnections.userId, userId), eq(stravaConnections.athleteId, connection.athleteId)));
  return parsed.data.access_token;
}
