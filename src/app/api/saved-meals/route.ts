import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { savedMealItems, savedMeals } from "@/lib/db/schema";
import { savedMealSchema } from "@/lib/validation/saved-meal";

export const GET = withUser(async (_request, userId) => {
  const db = getDb();
  const meals = await db
    .select()
    .from(savedMeals)
    .where(eq(savedMeals.userId, userId))
    .orderBy(asc(savedMeals.createdAt));
  if (!meals.length) return NextResponse.json([]);
  const items = await db
    .select()
    .from(savedMealItems)
    .where(eq(savedMealItems.userId, userId))
    .orderBy(savedMealItems.createdAt);
  return NextResponse.json(
    meals.map((meal) => ({
      ...meal,
      items: items.filter((item) => item.savedMealId === meal.id),
    })),
    { headers: { "Cache-Control": "private, no-store" } },
  );
});

export const POST = withUser(async (request, userId) => {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = savedMealSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);

  const db = getDb();
  const savedMealId = crypto.randomUUID();
  const [meal] = await db
    .insert(savedMeals)
    .values({ id: savedMealId, name: result.data.name, userId })
    .returning();
  try {
    await db.insert(savedMealItems).values(
      result.data.items.map((item, index) => ({
        ...item,
        id: crypto.randomUUID(),
        savedMealId,
        userId,
        servings: item.servings,
        createdAt: new Date(Date.now() + index),
      })),
    );
  } catch (error) {
    try {
      await db
        .delete(savedMeals)
        .where(and(eq(savedMeals.id, savedMealId), eq(savedMeals.userId, userId)));
    } catch (cleanupError) {
      const errorType =
        cleanupError instanceof Error ? cleanupError.name : "UnknownError";
      console.error(`Saved meal rollback failed (${errorType}).`);
    }
    throw error;
  }
  return NextResponse.json({ ...meal, items: result.data.items }, { status: 201 });
});
