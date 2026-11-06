import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { profiles, sleepEntries } from "@/lib/db/schema";
import { isDateString, todayFor } from "@/lib/health/dates";
import { sleepEntrySchema } from "@/lib/validation/sleep-entry";

async function listSleep(request: Request, userId: string) {
  const dateParam = new URL(request.url).searchParams.get("date");
  if (dateParam && !isDateString(dateParam)) {
    return NextResponse.json({ error: "Date must use YYYY-MM-DD format." }, { status: 400 });
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
  const date = dateParam ?? todayFor(profile.timezone);
  const entries = await db
    .select()
    .from(sleepEntries)
    .where(and(eq(sleepEntries.userId, userId), eq(sleepEntries.loggedOn, date)))
    .orderBy(desc(sleepEntries.loggedAt));
  return NextResponse.json(entries);
}

async function createSleep(request: Request, userId: string) {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = sleepEntrySchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);
  const { bedAt, wakeAt } = result.data;
  const values: typeof sleepEntries.$inferInsert = {
    loggedOn: result.data.loggedOn,
    sleepDate: result.data.sleepDate,
    bedAt: bedAt == null ? bedAt : new Date(bedAt),
    wakeAt: wakeAt == null ? wakeAt : new Date(wakeAt),
    durationMin: result.data.durationMin,
    quality: result.data.quality,
    awakenings: result.data.awakenings,
    notes: result.data.notes,
    userId,
  };
  const [entry] = await getDb()
    .insert(sleepEntries)
    .values(values)
    .returning();
  return NextResponse.json(entry, { status: 201 });
}

export const GET = withUser(listSleep);
export const POST = withUser(createSleep);
