import { describe, expect, it } from "vitest";
import {
  createMobileHandoffCode,
  hashMobileHandoffCode,
  isValidMobileHandoff,
  verifyMobileHandoffCode,
} from "./mobile-handoff";

const secret = "test-secret-with-enough-entropy";
const handoff = "a".repeat(43);

describe("mobile OAuth handoff", () => {
  it("validates handoff challenges and hashes opaque codes", () => {
    expect(isValidMobileHandoff(handoff)).toBe(true);
    expect(isValidMobileHandoff("short")).toBe(false);
    expect(hashMobileHandoffCode("one-time-code")).not.toBe("one-time-code");
  });

  it("verifies signed, unexpired codes bound to their handoff", () => {
    const code = createMobileHandoffCode(
      { userId: "user-123", handoff, expiresAt: 2000 },
      secret,
    );

    expect(verifyMobileHandoffCode(code, handoff, secret, 1000)).toMatchObject({
      userId: "user-123",
      handoff,
      expiresAt: 2000,
    });
    expect(verifyMobileHandoffCode(code, "b".repeat(43), secret, 1000)).toBeNull();
    expect(verifyMobileHandoffCode(code, handoff, "wrong-secret", 1000)).toBeNull();
    expect(verifyMobileHandoffCode(code, handoff, secret, 2000)).toBeNull();
  });
});
