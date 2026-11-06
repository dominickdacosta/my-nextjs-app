import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { dailyActivity, profiles } from "@/lib/db/schema";
import { isDateString, todayFor } from "@/lib/health/dates";
import { activitySchema } from "@/lib/validation/activity";

async function getActivity(request: Request, userId: string) {
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
  const [activity] = await db
    .select()
    .from(dailyActivity)
    .where(and(eq(dailyActivity.userId, userId), eq(dailyActivity.loggedOn, date)))
    .limit(1);
  return NextResponse.json(activity ?? null);
}

async function saveActivity(request: Request, userId: string) {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = activitySchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);
  const db = getDb();
  const now = new Date();
  const [activity] = await db
    .insert(dailyActivity)
    .values({ ...result.data, userId, loggedAt: now })
    .onConflictDoUpdate({
      target: [dailyActivity.userId, dailyActivity.loggedOn],
      set: {
        steps: result.data.steps,
        activeMinutes: result.data.activeMinutes,
        distanceM: result.data.distanceM,
        source: result.data.source,
        loggedAt: now,
        updatedAt: now,
      },
    })
    .returning();
  return NextResponse.json(activity);
}

export const GET = withUser(getActivity);
export const POST = withUser(saveActivity);
