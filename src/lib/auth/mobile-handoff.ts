import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type MobileHandoffPayload = {
  expiresAt: number;
  handoff: string;
  userId: string;
};

const handoffPattern = /^[A-Za-z0-9_-]{43}$/;

export function isValidMobileHandoff(value: string): boolean {
  return handoffPattern.test(value);
}

export function hashMobileHandoffCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function createMobileHandoffCode(
  payload: MobileHandoffPayload,
  secret: string,
): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyMobileHandoffCode(
  code: string,
  handoff: string,
  secret: string,
  now = Date.now(),
): MobileHandoffPayload | null {
  const [encodedPayload, signature, extra] = code.split(".");
  if (!encodedPayload || !signature || extra !== undefined) return null;

  const expectedSignature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest();
  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<MobileHandoffPayload>;
    if (
      typeof payload.userId !== "string" ||
      payload.userId.length === 0 ||
      typeof payload.handoff !== "string" ||
      payload.handoff !== handoff ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= now
    ) {
      return null;
    }
    return payload as MobileHandoffPayload;
  } catch {
    return null;
  }
}
