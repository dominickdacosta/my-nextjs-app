export type FoodSearchResult = {
  id: string;
  source: "history" | "fdc";
  nutritionSource: "estimated" | "verified" | "manual";
  name: string;
  brand: string | null;
  servingSize: number | null;
  servingUnit: string | null;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
};
