import { describe, expect, it } from "vitest";
import { foodEntrySchema } from "./food-entry";

describe("foodEntrySchema", () => {
  it("accepts a meal with optional nutrition values", () => {
    const result = foodEntrySchema.safeParse({
      loggedOn: "2026-03-16",
      meal: "lunch",
      name: "Rice",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.servings).toBe(1);
      expect(result.data.kcal).toBe(0);
    }
  });

  it("rejects invalid dates, meal types, and negative nutrition values", () => {
    expect(
      foodEntrySchema.safeParse({
        loggedOn: "2026-02-30",
        meal: "brunch",
        name: "Rice",
        kcal: -1,
      }).success,
    ).toBe(false);
  });

  it("trims names and rejects an empty name or excessive servings", () => {
    expect(
      foodEntrySchema.parse({
        loggedOn: "2026-03-16",
        meal: "dinner",
        name: "  Lentils  ",
        servings: 2,
      }).name,
    ).toBe("Lentils");
    expect(
      foodEntrySchema.safeParse({
        loggedOn: "2026-03-16",
        meal: "dinner",
        name: " ",
        servings: 101,
      }).success,
    ).toBe(false);
  });
});
