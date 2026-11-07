import { describe, expect, it } from "vitest";
import { parseFoodDescription, totalFoodNutrients } from "./food-parser";

describe("natural-language food estimates", () => {
  it("parses common Indian meals with explicit quantities", () => {
    const parsed = parseFoodDescription("2 chapatis and one bowl of dal");
    const totals = totalFoodNutrients(parsed.ingredients);

    expect(parsed.unsupported).toEqual([]);
    expect(parsed.ingredients.map((item) => item.name)).toEqual([
      "Chapati / roti",
      "Dal",
    ]);
    expect(totals.kcal).toBe(420);
    expect(totals.proteinG).toBe(17);
  });

  it("scales gram amounts without treating grams as servings", () => {
    const parsed = parseFoodDescription("150g grilled chicken and 200g rice");
    const totals = totalFoodNutrients(parsed.ingredients);

    expect(parsed.unsupported).toEqual([]);
    expect(totals.kcal).toBeCloseTo(503.75);
    expect(totals.proteinG).toBeCloseTo(51.875);
  });

  it("makes cooking assumptions visible and editable", () => {
    const parsed = parseFoodDescription("3 egg omelette");
    expect(parsed.ingredients).toHaveLength(2);
    expect(parsed.ingredients[1].name).toContain("Cooking oil");
    expect(parsed.assumptions.some((value) => value.includes("oil"))).toBe(true);
  });

  it("does not fabricate nutrition for unsupported foods", () => {
    const parsed = parseFoodDescription("a bowl of unfamiliar stew");
    expect(parsed.ingredients).toEqual([]);
    expect(parsed.unsupported).toEqual(["a bowl of unfamiliar stew"]);
  });
});
