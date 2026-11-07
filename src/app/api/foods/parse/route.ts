import { z } from "zod";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { parseFoodDescription, totalFoodNutrients } from "@/lib/health/food-parser";
import { NextResponse } from "next/server";

const requestSchema = z.object({
  description: z.string().trim().min(2).max(300),
});

export const POST = withUser(async (request) => {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = requestSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);

  const parsed = parseFoodDescription(result.data.description);
  if (parsed.unsupported.length || !parsed.ingredients.length) {
    return NextResponse.json(
      {
        error: "Some foods could not be estimated. Search for them or enter their nutrition manually.",
        unsupported: parsed.unsupported,
      },
      { status: 422 },
    );
  }
  return NextResponse.json({
    ...parsed,
    totals: totalFoodNutrients(parsed.ingredients),
    source: "estimated",
  });
});
