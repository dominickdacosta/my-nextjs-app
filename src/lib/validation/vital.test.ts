import { describe, expect, it } from "vitest";
import { vitalEntrySchema } from "./vital";

describe("vitalEntrySchema", () => {
  it("requires compatible values and units for blood pressure", () => {
    const base = {
      loggedOn: "2026-03-16",
      kind: "blood_pressure",
      valuePrimary: 120,
      valueSecondary: 80,
      unit: "mmHg",
    };
    expect(vitalEntrySchema.safeParse(base).success).toBe(true);
    expect(vitalEntrySchema.safeParse({ ...base, unit: "bpm" }).success).toBe(false);
    expect(vitalEntrySchema.safeParse({ ...base, valueSecondary: 140 }).success).toBe(false);
  });

  it("enforces specific ranges for oxygen and temperature", () => {
    expect(
      vitalEntrySchema.safeParse({
        loggedOn: "2026-03-16",
        kind: "oxygen_saturation",
        valuePrimary: 101,
        unit: "%",
      }).success,
    ).toBe(false);
    expect(
      vitalEntrySchema.safeParse({
        loggedOn: "2026-03-16",
        kind: "temperature",
        valuePrimary: 37,
        unit: "°C",
      }).success,
    ).toBe(true);
  });
});
