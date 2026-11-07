import { and, desc, eq, ilike } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { foodEntries } from "@/lib/db/schema";
import type { FoodSearchResult } from "@/lib/health/food-search";
import { mapOpenFoodFactsProducts } from "@/lib/health/open-food-facts";

type FdcNutrient = {
  nutrientId?: number;
  nutrientNumber?: string;
  value?: number | null;
};

type FdcFood = {
  fdcId: number;
  description: string;
  brandName?: string | null;
  servingSize?: number | null;
  servingSizeUnit?: string | null;
  foodNutrients?: FdcNutrient[];
  labelNutrients?: {
    calories?: { value?: number };
    protein?: { value?: number };
    carbohydrates?: { value?: number };
    fat?: { value?: number };
    fiber?: { value?: number };
  };
};

function nutrient(food: FdcFood, id: number, label: keyof NonNullable<FdcFood["labelNutrients"]>): number | null {
  const found = food.foodNutrients?.find(
    (item) => item.nutrientId === id || item.nutrientNumber === String(id),
  )?.value;
  return found ?? food.labelNutrients?.[label]?.value ?? null;
}

function mapFdcFood(food: FdcFood): FoodSearchResult {
  return {
    id: `fdc:${food.fdcId}`,
    source: "fdc",
    nutritionSource: "verified",
    name: food.description,
    brand: food.brandName ?? null,
    servingSize: food.servingSize ?? null,
    servingUnit: food.servingSizeUnit ?? null,
    kcal: nutrient(food, 1008, "calories"),
    proteinG: nutrient(food, 1003, "protein"),
    carbsG: nutrient(food, 1005, "carbohydrates"),
    fatG: nutrient(food, 1004, "fat"),
    fiberG: nutrient(food, 1079, "fiber"),
  };
}

async function searchFoods(request: Request, userId: string) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) {
    return NextResponse.json(
      { error: "Search text must be between 2 and 100 characters." },
      { status: 400 },
    );
  }

  const matches = await getDb()
    .select({
      id: foodEntries.id,
      name: foodEntries.name,
      servings: foodEntries.servings,
      kcal: foodEntries.kcal,
      proteinG: foodEntries.proteinG,
      carbsG: foodEntries.carbsG,
      fatG: foodEntries.fatG,
      fiberG: foodEntries.fiberG,
      nutritionSource: foodEntries.nutritionSource,
    })
    .from(foodEntries)
    .where(and(eq(foodEntries.userId, userId), ilike(foodEntries.name, `%${query}%`)))
    .orderBy(desc(foodEntries.loggedAt))
    .limit(50);
  const seen = new Set<string>();
  const history: FoodSearchResult[] = [];
  for (const match of matches) {
    const key = match.name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    history.push({
      id: `history:${match.id}`,
      source: "history",
      nutritionSource: match.nutritionSource,
      name: match.name,
      brand: null,
      servingSize: match.servings,
      servingUnit: "servings",
      kcal: match.kcal,
      proteinG: match.proteinG,
      carbsG: match.carbsG,
      fatG: match.fatG,
      fiberG: match.fiberG,
    });
    if (history.length === 8) break;
  }

  const [openFoodFacts, foodDataCentral] = await Promise.all([
    searchOpenFoodFacts(query),
    process.env.FDC_API_KEY
      ? searchFoodDataCentral(query, process.env.FDC_API_KEY)
      : Promise.resolve({ results: [] as FoodSearchResult[], warning: false }),
  ]);
  const results = [...history, ...foodDataCentral.results, ...openFoodFacts.results];
  const warning = openFoodFacts.warning || foodDataCentral.warning;
  if (warning && results.length === 0) {
    return NextResponse.json(
      { error: "Food search is temporarily unavailable." },
      { status: 502 },
    );
  }
  return NextResponse.json({
    results,
    ...(warning ? { warning: "Some food sources are temporarily unavailable." } : {}),
  });
}

async function searchOpenFoodFacts(
  query: string,
): Promise<{ results: FoodSearchResult[]; warning: boolean }> {
  const url = new URL("https://world.openfoodfacts.org/api/v2/search");
  url.searchParams.set("search_terms", query);
  url.searchParams.set(
    "fields",
    "code,product_name,brands,serving_size,nutriments",
  );
  url.searchParams.set("page_size", "12");
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "VitalsHealthTracker/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error(`Open Food Facts search failed (HTTP ${response.status}).`);
      return searchOpenFoodFactsLegacy(query);
    }
    return {
      results: mapOpenFoodFactsProducts(await response.json()),
      warning: false,
    };
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.error(`Open Food Facts search failed (${errorType}).`);
    return searchOpenFoodFactsLegacy(query);
  }
}

async function searchOpenFoodFactsLegacy(
  query: string,
): Promise<{ results: FoodSearchResult[]; warning: boolean }> {
  const url = new URL("https://us.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "12");
  url.searchParams.set("fields", "code,product_name,brands,serving_size,nutriments");
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "VitalsHealthTracker/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error(`Open Food Facts fallback search failed (HTTP ${response.status}).`);
      return { results: [], warning: true };
    }
    return {
      results: mapOpenFoodFactsProducts(await response.json()),
      warning: false,
    };
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.error(`Open Food Facts fallback search failed (${errorType}).`);
    return { results: [], warning: true };
  }
}

async function searchFoodDataCentral(
  query: string,
  apiKey: string,
): Promise<{ results: FoodSearchResult[]; warning: boolean }> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "12");
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error(`FoodData Central search failed (HTTP ${response.status}).`);
      return { results: [], warning: true };
    }
    const result = (await response.json()) as { foods?: FdcFood[] };
    return {
      results: (result.foods ?? []).map(mapFdcFood),
      warning: false,
    };
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.error(`FoodData Central search failed (${errorType}).`);
    return { results: [], warning: true };
  }
}

export const GET = withUser(searchFoods);
