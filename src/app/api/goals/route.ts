import { and, desc, eq, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { goals, profiles } from "@/lib/db/schema";
import { todayFor, isDateString } from "@/lib/health/dates";
import { invalidInput, withUser } from "@/lib/api";
import { goalsSchema } from "@/lib/validation/goals";

async function readGoals(request: Request, userId: string) {
  const dateParam = new URL(request.url).searchParams.get("date");
  if (dateParam && !isDateString(dateParam)) {
    return NextResponse.json({ error: "Date must use YYYY-MM-DD format." }, { status: 400 });
  }

  const [profile] = await getDb()
    .select({ timezone: profiles.timezone })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const effectiveDate = dateParam ?? todayFor(profile.timezone);
  const [goal] = await getDb()
    .select()
    .from(goals)
    .where(
      and(eq(goals.userId, userId), lte(goals.effectiveFrom, effectiveDate)),
    )
    .orderBy(desc(goals.effectiveFrom))
    .limit(1);

  if (!goal) {
    return NextResponse.json({ error: "Goals not found." }, { status: 404 });
  }
  return NextResponse.json(goal);
}

async function writeGoals(request: Request, userId: string) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    throw error;
  }

  const result = goalsSchema.safeParse(body);
  if (!result.success) return invalidInput(result.error.issues);

  const db = getDb();
  const [profile] = await db
    .select({ timezone: profiles.timezone })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const { effectiveFrom, ...targets } = result.data;
  const date = effectiveFrom ?? todayFor(profile.timezone);
  const [goal] = await db
    .insert(goals)
    .values({ ...targets, userId, effectiveFrom: date, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [goals.userId, goals.effectiveFrom],
      set: { ...targets, updatedAt: new Date() },
    })
    .returning();

  await db
    .update(profiles)
    .set({ onboardedAt: new Date(), updatedAt: new Date() })
    .where(eq(profiles.userId, userId));

  return NextResponse.json(goal);
}

export const GET = withUser(readGoals);
export const POST = withUser(writeGoals);
