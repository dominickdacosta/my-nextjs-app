import { describe, expect, it } from "vitest";
import {
  ageOnDate,
  calculateBmr,
  calculateTdee,
  calorieFloor,
  defaultMacros,
  estimateCaloriesFromSteps,
  isBelowCalorieFloor,
  suggestTargets,
} from "./energy";

const date = new Date("2026-11-06T12:00:00.000Z");
const profile = {
  sex: "female" as const,
  birthDate: "1990-06-15",
  heightCm: 165,
  weightKg: 70,
  activityLevel: "moderate" as const,
  goalType: "lose" as const,
  weeklyRateKg: 0.5,
};

describe("energy estimates", () => {
  it("calculates age around birthdays", () => {
    expect(ageOnDate("2000-11-07", date)).toBe(25);
    expect(ageOnDate("2000-11-06", date)).toBe(26);
  });

  it("uses Mifflin-St Jeor and averages unspecified sex", () => {
    expect(calculateBmr({ sex: "male", age: 30, heightCm: 180, weightKg: 80 })).toBe(1780);
    expect(calculateBmr({ sex: "female", age: 30, heightCm: 180, weightKg: 80 })).toBe(1614);
    expect(calculateBmr({ sex: "other", age: 30, heightCm: 180, weightKg: 80 })).toBe(1697);
  });

  it("applies activity factors and calorie floors", () => {
    expect(calculateTdee(1000, "moderate")).toBe(1550);
    expect(calculateTdee(1000, "sedentary")).toBe(1200);
    expect(calculateTdee(1000, "very_active")).toBe(1900);
    expect(calorieFloor("female")).toBe(1200);
    expect(calorieFloor("male")).toBe(1500);
    expect(calorieFloor("prefer_not")).toBe(1350);
    expect(isBelowCalorieFloor(1199, "female")).toBe(true);
    expect(isBelowCalorieFloor(1200, "female")).toBe(false);
    expect(isBelowCalorieFloor(1499, "male")).toBe(true);
    expect(() => calculateTdee(0, "moderate")).toThrow(RangeError);
  });

  it("estimates calories from steps without implying precision", () => {
    expect(estimateCaloriesFromSteps(0)).toBe(0);
    expect(estimateCaloriesFromSteps(10_000)).toBe(400);
    expect(() => estimateCaloriesFromSteps(-1)).toThrow(RangeError);
    expect(() => estimateCaloriesFromSteps(1.5)).toThrow(RangeError);
  });

  it("returns no targets for incomplete profiles and clamps low targets", () => {
    expect(suggestTargets({ sex: "female" }, date)).toBeNull();
    expect(
      suggestTargets({ ...profile, weeklyRateKg: 5 }, date)?.caloriesKcal,
    ).toBe(1200);
  });

  it("uses the documented macro and hydration defaults", () => {
    expect(defaultMacros(2000, 70)).toEqual({
      proteinG: 112,
      carbsG: 251,
      fatG: 61,
      fiberG: 28,
    });
    expect(suggestTargets(profile, date)).toMatchObject({
      waterMl: 2450,
      steps: 8000,
      sleepMinutes: 480,
      workoutsPerWeek: 3,
    });
  });
});
