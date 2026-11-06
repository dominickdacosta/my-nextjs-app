import { describe, expect, it } from "vitest";
import { bodyMeasurementSchema } from "./body-measurement";

describe("bodyMeasurementSchema", () => {
  it("accepts a single metric and rejects an empty measurement", () => {
    expect(
      bodyMeasurementSchema.safeParse({
        loggedOn: "2026-03-16",
        weightKg: 70,
      }).success,
    ).toBe(true);
    expect(
      bodyMeasurementSchema.safeParse({
        loggedOn: "2026-03-16",
      }).success,
    ).toBe(false);
  });
});
