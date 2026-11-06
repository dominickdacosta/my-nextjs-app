import { and, desc, eq, ilike } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { foodEntries } from "@/lib/db/schema";
import type { FoodSearchResult } from "@/lib/health/food-search";

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

  const apiKey = process.env.FDC_API_KEY;
  if (!apiKey) return NextResponse.json({ results: history });

  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "12");

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.error(`FoodData Central search failed (${errorType}).`);
    return NextResponse.json(
      { error: "Food search is temporarily unavailable." },
      { status: 502 },
    );
  }
  if (!response.ok) {
    console.error(`FoodData Central search failed (HTTP ${response.status}).`);
    return NextResponse.json(
      { error: "Food search is temporarily unavailable." },
      { status: 502 },
    );
  }

  try {
    const result = (await response.json()) as { foods?: FdcFood[] };
    const external = (result.foods ?? []).map(mapFdcFood);
    return NextResponse.json({ results: [...history, ...external] });
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.error(`FoodData Central response was invalid (${errorType}).`);
    return NextResponse.json(
      { error: "Food search returned an invalid response." },
      { status: 502 },
    );
  }
}

export const GET = withUser(searchFoods);
