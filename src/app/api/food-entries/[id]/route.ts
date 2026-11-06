import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { foodEntries } from "@/lib/db/schema";
import { foodRestoreSchema } from "@/lib/validation/food-entry";

function entryId(request: Request): string | null {
  const id = new URL(request.url).pathname.split("/").at(-1);
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

async function deleteFood(request: Request, userId: string) {
  const id = entryId(request);
  if (!id) {
    return NextResponse.json({ error: "Invalid entry ID." }, { status: 400 });
  }
  const [entry] = await getDb()
    .delete(foodEntries)
    .where(and(eq(foodEntries.id, id), eq(foodEntries.userId, userId)))
    .returning();
  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  return NextResponse.json(entry);
}

async function restoreFood(request: Request, userId: string) {
  const id = entryId(request);
  if (!id) {
    return NextResponse.json({ error: "Invalid entry ID." }, { status: 400 });
  }
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = foodRestoreSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);

  const { loggedAt, ...entryValues } = result.data;
  const db = getDb();
  const [entry] = await db
    .insert(foodEntries)
    .values({
      id,
      ...entryValues,
      loggedAt: new Date(loggedAt),
      userId,
    })
    .onConflictDoNothing()
    .returning();
  if (entry) return NextResponse.json(entry);

  const [ownedEntry] = await db
    .select()
    .from(foodEntries)
    .where(and(eq(foodEntries.id, id), eq(foodEntries.userId, userId)))
    .limit(1);
  if (!ownedEntry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  return NextResponse.json(ownedEntry);
}

export const DELETE = withUser(deleteFood);
export const POST = withUser(restoreFood);
