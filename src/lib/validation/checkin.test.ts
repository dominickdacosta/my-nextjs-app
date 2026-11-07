import { describe, expect, it } from "vitest";
import { checkinSchema } from "./checkin";

describe("checkinSchema", () => {
  it("accepts an energy check-in", () => {
    expect(checkinSchema.safeParse({ energy: 4 }).success).toBe(true);
  });

  it("does not accept mood as a check-in value", () => {
    expect(checkinSchema.safeParse({ mood: 4 }).success).toBe(false);
    expect(checkinSchema.safeParse({ mood: 4, energy: 3 })).toMatchObject({
      success: true,
      data: { energy: 3 },
    });
  });
});
