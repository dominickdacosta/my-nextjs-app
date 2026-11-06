import { describe, expect, it } from "vitest";
import { medicationSchema, medicationLogSchema } from "./medication";

describe("medication validation", () => {
  it("validates medication details and local reminder times", () => {
    expect(
      medicationSchema.safeParse({
        name: "Vitamin D",
        schedule: "Daily",
        times: ["08:30"],
        daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
      }).success,
    ).toBe(true);
    expect(
      medicationSchema.safeParse({
        name: "Vitamin D",
        schedule: "Daily",
        times: ["25:90"],
      }).success,
    ).toBe(false);
  });

  it("requires a valid date, dose schedule, and status", () => {
    expect(
      medicationLogSchema.safeParse({
        medicationId: "65f9af7a-89bb-47de-b2d0-59859926eb98",
        loggedOn: "2026-03-16",
        scheduledFor: "2026-03-16T08:30:00.000Z",
        status: "taken",
      }).success,
    ).toBe(true);
  });
});
