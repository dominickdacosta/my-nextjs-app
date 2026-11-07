export type FoodNutrients = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
};

export type ParsedFoodIngredient = {
  name: string;
  quantity: number;
  unit: string;
  perUnit: FoodNutrients;
};

export type FoodParseResult = {
  ingredients: ParsedFoodIngredient[];
  assumptions: string[];
  unsupported: string[];
};

type FoodDefinition = {
  name: string;
  aliases: string[];
  unit: string;
  perUnit: FoodNutrients;
  gramsPerUnit?: number;
  assumptions?: string[];
};

const catalog: FoodDefinition[] = [
  { name: "Egg", aliases: ["eggs?", "egg"], unit: "piece", perUnit: { kcal: 72, proteinG: 6.3, carbsG: 0.4, fatG: 4.8, fiberG: 0 } },
  { name: "Chapati / roti", aliases: ["chapatis?", "rotis?", "chapati", "roti"], unit: "piece", perUnit: { kcal: 120, proteinG: 3.5, carbsG: 20, fatG: 3.5, fiberG: 3 } },
  { name: "Dal", aliases: ["dal", "dhal", "lentils?\\s+curry"], unit: "bowl", perUnit: { kcal: 180, proteinG: 10, carbsG: 27, fatG: 4, fiberG: 7 }, gramsPerUnit: 200, assumptions: ["Dal estimate assumes one medium bowl (about 200 g), with a modest tempering."] },
  { name: "Cooked rice", aliases: ["rice"], unit: "bowl", perUnit: { kcal: 205, proteinG: 4.3, carbsG: 45, fatG: 0.4, fiberG: 0.6 }, gramsPerUnit: 160 },
  { name: "Grilled chicken", aliases: ["grilled chicken", "roasted chicken", "chicken"], unit: "100 g", perUnit: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0 }, gramsPerUnit: 100 },
  { name: "Fish curry", aliases: ["fish curry"], unit: "serving", perUnit: { kcal: 240, proteinG: 24, carbsG: 8, fatG: 12, fiberG: 1 }, gramsPerUnit: 200, assumptions: ["Fish curry estimate assumes one medium serving (about 200 g), including gravy."] },
  { name: "Milk", aliases: ["milk"], unit: "glass", perUnit: { kcal: 150, proteinG: 8, carbsG: 12, fatG: 8, fiberG: 0 }, gramsPerUnit: 240, assumptions: ["Milk estimate assumes whole milk; the actual value varies by type and serving size."] },
  { name: "Bread", aliases: ["bread"], unit: "slice", perUnit: { kcal: 80, proteinG: 3, carbsG: 15, fatG: 1, fiberG: 1 }, assumptions: ["Bread estimate uses a typical slice; brands and slice sizes vary."] },
  { name: "Butter", aliases: ["butter"], unit: "tsp", perUnit: { kcal: 34, proteinG: 0, carbsG: 0, fatG: 3.8, fiberG: 0 } },
  { name: "Cooking oil", aliases: ["oil"], unit: "tsp", perUnit: { kcal: 40, proteinG: 0, carbsG: 0, fatG: 4.5, fiberG: 0 } },
  { name: "Paneer", aliases: ["paneer"], unit: "100 g", perUnit: { kcal: 265, proteinG: 18.3, carbsG: 1.2, fatG: 20.8, fiberG: 0 }, gramsPerUnit: 100 },
  { name: "Plain yogurt", aliases: ["yogurt", "curd"], unit: "bowl", perUnit: { kcal: 120, proteinG: 7, carbsG: 9, fatG: 6, fiberG: 0 }, gramsPerUnit: 200 },
  { name: "Oats", aliases: ["oats?", "porridge"], unit: "40 g", perUnit: { kcal: 152, proteinG: 5.3, carbsG: 27, fatG: 2.7, fiberG: 4 }, gramsPerUnit: 40 },
  { name: "Banana", aliases: ["bananas?", "banana"], unit: "piece", perUnit: { kcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, fiberG: 3.1 } },
  { name: "Sugar", aliases: ["sugar"], unit: "tsp", perUnit: { kcal: 16, proteinG: 0, carbsG: 4, fatG: 0, fiberG: 0 } },
  { name: "Dosa", aliases: ["dosas?", "dosa"], unit: "piece", perUnit: { kcal: 168, proteinG: 4, carbsG: 27, fatG: 5, fiberG: 2 } },
  { name: "Idli", aliases: ["idlis?", "idli"], unit: "piece", perUnit: { kcal: 58, proteinG: 2, carbsG: 12, fatG: 0.4, fiberG: 1 } },
  { name: "Potato", aliases: ["potatoes", "potato"], unit: "100 g", perUnit: { kcal: 87, proteinG: 1.9, carbsG: 20.1, fatG: 0.1, fiberG: 1.8 }, gramsPerUnit: 100 },
];

const numberWords: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  half: 0.5,
};

function parseQuantity(text: string): { quantity: number; unit: string | null } {
  const amount = text.match(
    /^\s*(\d+(?:\.\d+)?)\s*(g|grams?|ml|millilit(?:er|re)s?)?\b/i,
  );
  if (amount) {
    const unit = amount[2]?.toLowerCase();
    return {
      quantity: Number(amount[1]),
      unit: unit?.startsWith("g") ? "g" : unit ? "ml" : null,
    };
  }
  const word = text.match(/^\s*(a|an|one|two|three|four|five|six|half)\b/i);
  return {
    quantity: word ? numberWords[word[1].toLowerCase()] : 1,
    unit: null,
  };
}

function normalizeSegment(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/\b(grilled|roasted|boiled|cooked|fried|steamed|fresh|large|small|medium|of|serving|serve|bowl|glass|slice|pieces?|piece|slices?|cups?|tablespoons?|tbsp|teaspoons?|tsp)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function definitionFor(segment: string): FoodDefinition | undefined {
  return [...catalog]
    .sort((left, right) => Math.max(...right.aliases.map((alias) => alias.length)) - Math.max(...left.aliases.map((alias) => alias.length)))
    .find((definition) =>
      definition.aliases.some((alias) =>
        new RegExp(`\\b(?:${alias})\\b`, "i").test(segment),
      ),
    );
}

function quantityUnit(
  definition: FoodDefinition,
  quantity: number,
  unit: string | null,
): { quantity: number; unit: string; nutrientScale: number } {
  if (unit === "g" || unit === "ml") {
    return {
      quantity,
      unit,
      nutrientScale: 1 / (definition.gramsPerUnit ?? 100),
    };
  }
  return { quantity, unit: definition.unit, nutrientScale: 1 };
}

export function parseFoodDescription(description: string): FoodParseResult {
  const segments = description
    .split(/,|\band\b|\bplus\b|\bwith\b|\+/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const ingredients: ParsedFoodIngredient[] = [];
  const assumptions: string[] = [];
  const unsupported: string[] = [];

  for (const segment of segments) {
    const definition = definitionFor(segment);
    if (!definition) {
      unsupported.push(segment);
      continue;
    }

    const normalized = normalizeSegment(segment);
    const parsedAmount = parseQuantity(segment);
    const { quantity, unit, nutrientScale } = quantityUnit(
      definition,
      parsedAmount.quantity,
      parsedAmount.unit,
    );

    ingredients.push({
      name: definition.name,
      quantity,
      unit,
      perUnit: {
        kcal: definition.perUnit.kcal * nutrientScale,
        proteinG: definition.perUnit.proteinG * nutrientScale,
        carbsG: definition.perUnit.carbsG * nutrientScale,
        fatG: definition.perUnit.fatG * nutrientScale,
        fiberG: definition.perUnit.fiberG * nutrientScale,
      },
    });
    assumptions.push(...(definition.assumptions ?? []));

    if (definition.name === "Egg" && /\bomelet(?:te)?\b/i.test(normalized)) {
      ingredients.push({
        name: "Cooking oil (assumed)",
        quantity: 1,
        unit: "tsp",
        perUnit: { kcal: 40, proteinG: 0, carbsG: 0, fatG: 4.5, fiberG: 0 },
      });
      assumptions.push("Omelette estimate includes 1 teaspoon of cooking oil; adjust or remove it if needed.");
    }
  }

  if (!segments.length) unsupported.push(description);
  return {
    ingredients,
    assumptions: [...new Set(assumptions)],
    unsupported,
  };
}

export function totalFoodNutrients(ingredients: ParsedFoodIngredient[]): FoodNutrients {
  return ingredients.reduce(
    (total, ingredient) => ({
      kcal: total.kcal + ingredient.quantity * ingredient.perUnit.kcal,
      proteinG: total.proteinG + ingredient.quantity * ingredient.perUnit.proteinG,
      carbsG: total.carbsG + ingredient.quantity * ingredient.perUnit.carbsG,
      fatG: total.fatG + ingredient.quantity * ingredient.perUnit.fatG,
      fiberG: total.fiberG + ingredient.quantity * ingredient.perUnit.fiberG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  );
}
