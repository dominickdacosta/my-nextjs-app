import { describe, expect, it } from "vitest";
import {
  mapOpenFoodFactsProduct,
  mapOpenFoodFactsProducts,
} from "./open-food-facts";

describe("Open Food Facts mapping", () => {
  it("uses per-serving values and scales missing nutrients from the serving weight", () => {
    expect(
      mapOpenFoodFactsProduct({
        code: "123",
        product_name: "Test cereal",
        brands: "Test Foods, Other Brand",
        serving_size: "1 bowl (50 g)",
        nutriments: {
          "energy-kcal_serving": 190,
          "energy-kcal_100g": 380,
          proteins_serving: 6,
          proteins_100g: 12,
          carbohydrates_100g: 70,
          fat_100g: 8,
          fiber_100g: 4,
        },
      }),
    ).toEqual({
      id: "open-food-facts:123",
      source: "open-food-facts",
      nutritionSource: "estimated",
      name: "Test cereal",
      brand: "Test Foods",
      servingSize: 50,
      servingUnit: "g",
      kcal: 190,
      proteinG: 6,
      carbsG: 35,
      fatG: 4,
      fiberG: 2,
    });
  });

  it("uses per-100 g macros when no serving values or weight are available", () => {
    expect(
      mapOpenFoodFactsProduct({
        code: "456",
        product_name: "Plain oats",
        nutriments: { "energy-kcal_100g": 370, proteins_100g: 13 },
      }),
    ).toMatchObject({
      servingSize: 100,
      servingUnit: "g",
      kcal: 370,
      proteinG: 13,
    });
  });

  it("skips invalid and nutrition-empty products and deduplicates results", () => {
    const product = {
      code: "789",
      product_name: "Rice",
      nutriments: { carbohydrates_100g: 80 },
    };
    expect(
      mapOpenFoodFactsProducts({
        products: [null, { ...product, code: "" }, { code: "0", product_name: "Empty", nutriments: {} }, product, product],
      }),
    ).toHaveLength(1);
  });
});
