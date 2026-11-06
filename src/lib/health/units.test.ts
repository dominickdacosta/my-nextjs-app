import { describe, expect, it } from "vitest";
import {
  cmToFeetInches,
  cmToInches,
  feetInchesToCm,
  flOzToMl,
  formatDistance,
  formatHeight,
  formatVolume,
  formatWeight,
  inchesToCm,
  kgToLb,
  metersToKilometers,
  kilometersToMeters,
  kilometersToMiles,
  lbToKg,
  metersToMiles,
  milesToMeters,
  milesToKilometers,
  mlToFlOz,
} from "./units";

describe("unit conversions", () => {
  it("round-trips canonical body and volume measures", () => {
    expect(lbToKg(kgToLb(73.4))).toBeCloseTo(73.4, 8);
    expect(inchesToCm(cmToInches(172.5))).toBeCloseTo(172.5, 8);
    expect(flOzToMl(mlToFlOz(750))).toBeCloseTo(750, 7);
    expect(milesToMeters(metersToMiles(5000))).toBeCloseTo(5000, 7);
    expect(feetInchesToCm(5, 8)).toBeCloseTo(172.72, 8);
    expect(metersToKilometers(2500)).toBe(2.5);
    expect(kilometersToMeters(2.5)).toBe(2500);
    expect(milesToKilometers(kilometersToMiles(12))).toBeCloseTo(12, 8);
  });

  it("carries rounded inches into the next foot", () => {
    expect(cmToFeetInches(182.88)).toEqual({ feet: 6, inches: 0 });
  });

  it("formats values with the selected units", () => {
    expect(formatWeight(70, "imperial")).toBe("154.3 lb");
    expect(formatHeight(170, "metric")).toBe("170 cm");
    expect(formatHeight(170, "imperial")).toBe("5 ft 7 in");
    expect(formatVolume(250, "imperial")).toBe("8.5 fl oz");
    expect(formatVolume(250, "metric")).toBe("250 ml");
    expect(formatDistance(500, "metric")).toBe("0.50 km");
    expect(formatDistance(1609.344, "imperial")).toBe("1.00 mi");
  });
});
