import type { FoodSearchResult } from "./food-search";

type NutrientKey = "energy-kcal" | "proteins" | "carbohydrates" | "fat" | "fiber";

const nutrients: Array<{ key: NutrientKey; field: keyof FoodSearchResult }> = [
  { key: "energy-kcal", field: "kcal" },
  { key: "proteins", field: "proteinG" },
  { key: "carbohydrates", field: "carbsG" },
  { key: "fat", field: "fatG" },
  { key: "fiber", field: "fiberG" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numericValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function servingWeightGrams(servingSize: string | null): number | null {
  if (!servingSize) return null;
  const match = /(\d+(?:[.,]\d+)?)\s*g(?:ram)?s?\b/i.exec(servingSize);
  if (!match) return null;
  const grams = Number(match[1].replace(",", "."));
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}

export function mapOpenFoodFactsProduct(value: unknown): FoodSearchResult | null {
  if (!isRecord(value) || !isRecord(value.nutriments)) return null;
  const code = typeof value.code === "string" ? value.code.trim() : "";
  const name =
    typeof value.product_name === "string" ? value.product_name.trim() : "";
  if (!code || !name) return null;

  const sourceNutrients = value.nutriments;
  const servingSizeText =
    typeof value.serving_size === "string" ? value.serving_size : null;
  const grams = servingWeightGrams(servingSizeText);
  const hasServingValues = nutrients.some(
    ({ key }) => numericValue(sourceNutrients[`${key}_serving`]) !== null,
  );
  const useServingValues = grams !== null || hasServingValues;
  const values = Object.fromEntries(
    nutrients.map(({ key, field }) => {
      const servingValue = numericValue(sourceNutrients[`${key}_serving`]);
      const perHundredGrams = numericValue(sourceNutrients[`${key}_100g`]);
      const result =
        servingValue ??
        (grams !== null && perHundredGrams !== null
          ? (perHundredGrams * grams) / 100
          : useServingValues
            ? null
            : perHundredGrams);
      return [field, result];
    }),
  ) as Pick<
    FoodSearchResult,
    "kcal" | "proteinG" | "carbsG" | "fatG" | "fiberG"
  >;

  if (Object.values(values).every((item) => item === null)) return null;

  return {
    id: `open-food-facts:${code}`,
    source: "open-food-facts",
    nutritionSource: "estimated",
    name,
    brand: typeof value.brands === "string" ? value.brands.split(",")[0].trim() || null : null,
    servingSize: grams ?? (useServingValues ? 1 : 100),
    servingUnit: grams !== null ? "g" : useServingValues ? "serving" : "g",
    ...values,
  };
}

export function mapOpenFoodFactsProducts(value: unknown): FoodSearchResult[] {
  if (!isRecord(value) || !Array.isArray(value.products)) return [];
  const results: FoodSearchResult[] = [];
  const seen = new Set<string>();
  for (const product of value.products) {
    const mapped = mapOpenFoodFactsProduct(product);
    if (!mapped || seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    results.push(mapped);
  }
  return results;
}
