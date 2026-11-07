import { and, count, desc, eq, gte, gt, isNull, lte, max, min, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import {
  bodyMeasurements,
  dailyActivity,
  dailyCheckins,
  foodEntries,
  exercises,
  goals,
  profiles,
  sleepEntries,
  vitals,
  waterEntries,
  workoutSets,
  workouts,
} from "@/lib/db/schema";
import { addDays, dateRange, todayFor } from "@/lib/health/dates";
import {
  aggregateTrendDays,
  countLogStreaks,
  summarizeStrengthProgress,
} from "@/lib/health/trends";

async function getTrends(request: Request, userId: string) {
  const daysParam = new URL(request.url).searchParams.get("days") ?? "30";
  if (!["7", "30", "90"].includes(daysParam)) {
    return NextResponse.json(
      { error: "Trend range must be 7, 30, or 90 days." },
      { status: 400 },
    );
  }
  const range = Number(daysParam);
  const db = getDb();
  const [profile] = await db
    .select({
      timezone: profiles.timezone,
      unitSystem: profiles.unitSystem,
      hideCalories: profiles.hideCalories,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const today = todayFor(profile.timezone);
  const from = addDays(today, -(range - 1));
  const comparisonFrom = addDays(from, -range);
  const dates = dateRange(comparisonFrom, today);
  const dateFilter = (column: typeof foodEntries.loggedOn) =>
    and(eq(foodEntries.userId, userId), gte(column, comparisonFrom), lte(column, today));
  const [
    food,
    water,
    measurements,
    workoutRows,
    sleep,
    activity,
    checkins,
    vitalDays,
    goalRows,
    strengthRows,
    vitalRows,
    runningRecordRows,
  ] = await Promise.all([
    db
      .select({
        loggedOn: foodEntries.loggedOn,
        servings: foodEntries.servings,
        kcal: foodEntries.kcal,
        proteinG: foodEntries.proteinG,
        carbsG: foodEntries.carbsG,
        fatG: foodEntries.fatG,
        fiberG: foodEntries.fiberG,
      })
      .from(foodEntries)
      .where(dateFilter(foodEntries.loggedOn)),
    db
      .select({ loggedOn: waterEntries.loggedOn, amountMl: waterEntries.amountMl })
      .from(waterEntries)
      .where(
        and(
          eq(waterEntries.userId, userId),
          gte(waterEntries.loggedOn, comparisonFrom),
          lte(waterEntries.loggedOn, today),
        ),
      ),
    db
      .select({
        loggedOn: bodyMeasurements.loggedOn,
        weightKg: bodyMeasurements.weightKg,
        waistCm: bodyMeasurements.waistCm,
        bodyFatPct: bodyMeasurements.bodyFatPct,
        loggedAt: bodyMeasurements.loggedAt,
      })
      .from(bodyMeasurements)
      .where(
        and(
          eq(bodyMeasurements.userId, userId),
          gte(bodyMeasurements.loggedOn, comparisonFrom),
          lte(bodyMeasurements.loggedOn, today),
        ),
      )
      .orderBy(desc(bodyMeasurements.loggedAt)),
    db
      .select({
        loggedOn: workouts.loggedOn,
        durationMin: workouts.durationMin,
        durationSeconds: workouts.durationSeconds,
        type: workouts.type,
        distanceM: workouts.distanceM,
      })
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, userId),
          gte(workouts.loggedOn, comparisonFrom),
          lte(workouts.loggedOn, today),
        ),
      ),
    db
      .select({
        loggedOn: sleepEntries.loggedOn,
        durationMin: sleepEntries.durationMin,
      })
      .from(sleepEntries)
      .where(
        and(
          eq(sleepEntries.userId, userId),
          gte(sleepEntries.loggedOn, comparisonFrom),
          lte(sleepEntries.loggedOn, today),
        ),
      ),
    db
      .select({
        loggedOn: dailyActivity.loggedOn,
        steps: dailyActivity.steps,
        activeMinutes: dailyActivity.activeMinutes,
        source: dailyActivity.source,
      })
      .from(dailyActivity)
      .where(
        and(
          eq(dailyActivity.userId, userId),
          gte(dailyActivity.loggedOn, comparisonFrom),
          lte(dailyActivity.loggedOn, today),
        ),
      ),
    db
      .select({
        loggedOn: dailyCheckins.loggedOn,
        energy: dailyCheckins.energy,
      })
      .from(dailyCheckins)
      .where(
        and(
          eq(dailyCheckins.userId, userId),
          gte(dailyCheckins.loggedOn, comparisonFrom),
          lte(dailyCheckins.loggedOn, today),
        ),
      ),
    db
      .select({ loggedOn: vitals.loggedOn })
      .from(vitals)
      .where(
        and(
          eq(vitals.userId, userId),
          gte(vitals.loggedOn, comparisonFrom),
          lte(vitals.loggedOn, today),
        ),
      ),
    db
      .select({
        effectiveFrom: goals.effectiveFrom,
        caloriesKcal: goals.caloriesKcal,
        proteinG: goals.proteinG,
        carbsG: goals.carbsG,
        fatG: goals.fatG,
        fiberG: goals.fiberG,
      })
      .from(goals)
      .where(and(eq(goals.userId, userId), lte(goals.effectiveFrom, today)))
      .orderBy(desc(goals.effectiveFrom))
      .limit(1),
    db
      .select({
        exerciseId: workoutSets.exerciseId,
        exerciseName: exercises.name,
        loggedOn: workouts.loggedOn,
        weightKg: workoutSets.weightKg,
        reps: workoutSets.reps,
        isWarmup: workoutSets.isWarmup,
        completed: workoutSets.completed,
      })
      .from(workoutSets)
      .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
      .innerJoin(exercises, eq(exercises.id, workoutSets.exerciseId))
      .where(
        and(
          eq(workoutSets.userId, userId),
          eq(workouts.userId, userId),
          eq(workouts.type, "strength"),
          gte(workouts.loggedOn, comparisonFrom),
          lte(workouts.loggedOn, today),
          or(isNull(exercises.userId), eq(exercises.userId, userId)),
        ),
      ),
    db
      .select({
        loggedOn: vitals.loggedOn,
        kind: vitals.kind,
        valuePrimary: vitals.valuePrimary,
        valueSecondary: vitals.valueSecondary,
        unit: vitals.unit,
      })
      .from(vitals)
      .where(
        and(
          eq(vitals.userId, userId),
          gte(vitals.loggedOn, from),
          lte(vitals.loggedOn, today),
        ),
      )
      .orderBy(desc(vitals.loggedAt)),
    db
      .select({
        longestDistanceM: max(workouts.distanceM),
        fastestPaceSecPerKm: min(workouts.avgPaceSecPerKm),
        runCount: count(),
      })
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, userId),
          eq(workouts.type, "run"),
          gt(workouts.distanceM, 0),
        ),
      ),
  ]);
  const trendDays = aggregateTrendDays({
    dates,
    food,
    water,
    weights: measurements,
    workouts: workoutRows,
    sleep,
    activity,
    checkins,
    vitals: vitalDays,
  });
  const currentDays = trendDays.filter((day) => day.date >= from);
  const comparisonDays = trendDays.filter((day) => day.date < from);
  const latestVitals: typeof vitalRows = [];
  const seenVitalKinds = new Set<string>();
  for (const vital of vitalRows) {
    if (seenVitalKinds.has(vital.kind)) continue;
    seenVitalKinds.add(vital.kind);
    latestVitals.push(vital);
  }
  return NextResponse.json(
    {
      from,
      to: today,
      comparisonFrom,
      comparisonTo: addDays(from, -1),
      profile,
      goals: goalRows[0] ?? null,
      days: currentDays,
      comparisonDays,
      streaks: countLogStreaks(currentDays, today),
      strengthProgress: summarizeStrengthProgress(strengthRows),
      latestVitals,
      runningRecords: {
        longestDistanceM: runningRecordRows[0]?.longestDistanceM ?? null,
        fastestPaceSecPerKm: runningRecordRows[0]?.fastestPaceSecPerKm ?? null,
        runCount: runningRecordRows[0]?.runCount ?? 0,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export const GET = withUser(getTrends);
