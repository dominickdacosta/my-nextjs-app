import { describe, expect, it } from "vitest";
import { activitySchema } from "./activity";

describe("activitySchema", () => {
  it("accepts manual activity without step counts", () => {
    expect(
      activitySchema.safeParse({
        loggedOn: "2026-03-15",
        activeMinutes: 30,
        distanceM: 1200,
      }).success,
    ).toBe(true);
  });

  it("rejects manual step counts", () => {
    expect(
      activitySchema.safeParse({
        loggedOn: "2026-03-15",
        steps: 5000,
      }).success,
    ).toBe(false);
  });
});
