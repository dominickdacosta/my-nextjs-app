import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { foodEntries, savedMealItems, savedMeals } from "@/lib/db/schema";
import { logSavedMealSchema } from "@/lib/validation/saved-meal";

export const POST = withUser(async (request, userId) => {
  const id = new URL(request.url).pathname.split("/").at(-2);
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid saved meal ID." }, { status: 400 });
  }
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = logSavedMealSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);

  const db = getDb();
  const [meal] = await db
    .select({ id: savedMeals.id })
    .from(savedMeals)
    .where(and(eq(savedMeals.id, id), eq(savedMeals.userId, userId)))
    .limit(1);
  if (!meal) return NextResponse.json({ error: "Saved meal not found." }, { status: 404 });
  const items = await db
    .select()
    .from(savedMealItems)
    .where(and(eq(savedMealItems.savedMealId, id), eq(savedMealItems.userId, userId)));
  if (!items.length) return NextResponse.json({ error: "Saved meal has no items." }, { status: 409 });

  const inserted = await db
    .insert(foodEntries)
    .values(
      items.map((item) => ({
        userId,
        loggedOn: result.data.loggedOn,
        meal: result.data.meal,
        foodId: item.foodId,
        name: item.name,
        servings: item.servings,
        kcal: item.kcal,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        fiberG: item.fiberG,
        nutritionSource: item.nutritionSource,
        notes: "Added from a saved meal.",
      })),
    )
    .returning({ id: foodEntries.id });
  return NextResponse.json({ logged: inserted.length }, { status: 201 });
});
