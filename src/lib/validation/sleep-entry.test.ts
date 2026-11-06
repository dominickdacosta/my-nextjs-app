import { describe, expect, it } from "vitest";
import { sleepEntrySchema } from "./sleep-entry";

describe("sleepEntrySchema", () => {
  it("accepts a dated duration and quality record", () => {
    expect(
      sleepEntrySchema.safeParse({
        loggedOn: "2026-03-16",
        sleepDate: "2026-03-15",
        durationMin: 480,
        quality: 4,
      }).success,
    ).toBe(true);
  });

  it("rejects empty or out-of-range sleep data", () => {
    expect(
      sleepEntrySchema.safeParse({
        loggedOn: "2026-03-16",
        sleepDate: "2026-03-16",
      }).success,
    ).toBe(false);
    expect(
      sleepEntrySchema.safeParse({
        loggedOn: "2026-03-16",
        sleepDate: "2026-03-16",
        durationMin: 1500,
      }).success,
    ).toBe(false);
  });
});
