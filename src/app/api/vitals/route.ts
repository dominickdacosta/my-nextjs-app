import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { profiles, vitals } from "@/lib/db/schema";
import { isDateString, todayFor } from "@/lib/health/dates";
import { vitalEntrySchema } from "@/lib/validation/vital";

async function listVitals(request: Request, userId: string) {
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
    .from(vitals)
    .where(and(eq(vitals.userId, userId), eq(vitals.loggedOn, date)))
    .orderBy(desc(vitals.loggedAt));
  return NextResponse.json(entries);
}

async function createVital(request: Request, userId: string) {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = vitalEntrySchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);
  const values = {
    ...result.data,
    measuredAt: result.data.measuredAt
      ? new Date(result.data.measuredAt)
      : new Date(),
  };
  const [entry] = await getDb()
    .insert(vitals)
    .values({ ...values, userId })
    .returning();
  return NextResponse.json(entry, { status: 201 });
}

export const GET = withUser(listVitals);
export const POST = withUser(createVital);
