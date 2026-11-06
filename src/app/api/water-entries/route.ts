import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { profiles, waterEntries } from "@/lib/db/schema";
import { isDateString, todayFor } from "@/lib/health/dates";
import { waterEntrySchema } from "@/lib/validation/water";

async function listWater(request: Request, userId: string) {
  const date = new URL(request.url).searchParams.get("date");
  if (date && !isDateString(date)) {
    return NextResponse.json(
      { error: "Date must use YYYY-MM-DD format." },
      { status: 400 },
    );
  }
  const db = getDb();
  const [profile] = await db
    .select({ timezone: profiles.timezone })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const loggedOn = date ?? todayFor(profile.timezone);
  const entries = await db
    .select()
    .from(waterEntries)
    .where(
      and(
        eq(waterEntries.userId, userId),
        eq(waterEntries.loggedOn, loggedOn),
      ),
    )
    .orderBy(desc(waterEntries.loggedAt));
  return NextResponse.json({
    entries,
    totalMl: entries.reduce((total, entry) => total + entry.amountMl, 0),
  });
}

async function createWater(request: Request, userId: string) {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = waterEntrySchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);

  const [entry] = await getDb()
    .insert(waterEntries)
    .values({ ...result.data, userId })
    .returning();
  return NextResponse.json(entry, { status: 201 });
}

export const GET = withUser(listWater);
export const POST = withUser(createWater);
