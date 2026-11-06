import { and, desc, eq, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import {
  bodyMeasurements,
  dailyActivity,
  dailyCheckins,
  foodEntries,
  goals,
  profiles,
  sleepEntries,
  vitals,
  waterEntries,
  workouts,
} from "@/lib/db/schema";
import { isDateString, todayFor } from "@/lib/health/dates";

async function getDay(request: Request, userId: string) {
  const dateParam = new URL(request.url).searchParams.get("date");
  if (dateParam && !isDateString(dateParam)) {
    return NextResponse.json(
      { error: "Date must use YYYY-MM-DD format." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [profile] = await db
    .select({
      displayName: profiles.displayName,
      unitSystem: profiles.unitSystem,
      timezone: profiles.timezone,
      hideCalories: profiles.hideCalories,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const date = dateParam ?? todayFor(profile.timezone);
  const [
    water,
    measurements,
    checkinRows,
    activityRows,
    food,
    workoutRows,
    sleepRows,
    vitalRows,
    goalRows,
  ] = await Promise.all([
    db
      .select()
      .from(waterEntries)
      .where(and(eq(waterEntries.userId, userId), eq(waterEntries.loggedOn, date)))
      .orderBy(desc(waterEntries.loggedAt)),
    db
      .select()
      .from(bodyMeasurements)
      .where(
        and(
          eq(bodyMeasurements.userId, userId),
          eq(bodyMeasurements.loggedOn, date),
        ),
      )
      .orderBy(desc(bodyMeasurements.loggedAt)),
    db
      .select()
      .from(dailyCheckins)
      .where(
        and(
          eq(dailyCheckins.userId, userId),
          eq(dailyCheckins.loggedOn, date),
        ),
      )
      .limit(1),
    db
      .select()
      .from(dailyActivity)
      .where(
        and(eq(dailyActivity.userId, userId), eq(dailyActivity.loggedOn, date)),
      )
      .limit(1),
    db
      .select()
      .from(foodEntries)
      .where(and(eq(foodEntries.userId, userId), eq(foodEntries.loggedOn, date)))
      .orderBy(desc(foodEntries.loggedAt)),
    db
      .select()
      .from(workouts)
      .where(and(eq(workouts.userId, userId), eq(workouts.loggedOn, date)))
      .orderBy(desc(workouts.loggedAt)),
    db
      .select()
      .from(sleepEntries)
      .where(and(eq(sleepEntries.userId, userId), eq(sleepEntries.loggedOn, date)))
      .orderBy(desc(sleepEntries.loggedAt)),
    db
      .select()
      .from(vitals)
      .where(and(eq(vitals.userId, userId), eq(vitals.loggedOn, date)))
      .orderBy(desc(vitals.loggedAt)),
    db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), lte(goals.effectiveFrom, date)))
      .orderBy(desc(goals.effectiveFrom))
      .limit(1),
  ]);

  return NextResponse.json({
    date,
    profile,
    goals: goalRows[0] ?? null,
    water: {
      entries: water,
      totalMl: water.reduce((total, entry) => total + entry.amountMl, 0),
    },
    measurements,
    weight: measurements.find((measurement) => measurement.weightKg !== null) ?? null,
    checkin: checkinRows[0] ?? null,
    activity: activityRows[0] ?? null,
    vitals: vitalRows,
    food,
    workouts: workoutRows,
    sleep: sleepRows[0] ?? null,
  });
}

export const GET = withUser(getDay);
