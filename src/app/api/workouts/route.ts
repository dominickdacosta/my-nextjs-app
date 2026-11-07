import {
  and,
  desc,
  eq,
  gte,
  isNotNull,
  lte,
} from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { bodyMeasurements, workoutSets, workouts } from "@/lib/db/schema";
import { isDateString } from "@/lib/health/dates";
import {
  accessibleExerciseIds,
  workoutSetsFor,
} from "@/lib/health/workout-queries";
import {
  averagePaceSecPerKm,
  estimateWorkoutCalories,
  routeDistanceM,
  sanitizeRunRoutePoints,
} from "@/lib/health/running";
import { workoutSchema } from "@/lib/validation/workout";

async function listWorkouts(request: Request, userId: string) {
  const params = new URL(request.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if (!from || !to || !isDateString(from) || !isDateString(to) || from > to) {
    return NextResponse.json(
      { error: "A valid from and to date are required." },
      { status: 400 },
    );
  }
  const rangeLength =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000 +
    1;
  if (rangeLength > 31) {
    return NextResponse.json(
      { error: "Workout history can span at most 31 days." },
      { status: 400 },
    );
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.loggedOn, from),
        lte(workouts.loggedOn, to),
      ),
    )
    .orderBy(desc(workouts.loggedOn), desc(workouts.loggedAt));
  const sets = await workoutSetsFor(userId, rows.map((workout) => workout.id));
  return NextResponse.json(
    rows.map((workout) => ({
      ...workout,
      sets: sets.filter((set) => set.workoutId === workout.id),
    })),
  );
}

async function createWorkout(request: Request, userId: string) {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = workoutSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);

  const { sets, startedAt, ...workoutValues } = result.data;
  const exerciseIds = sets.flatMap((set) => set.exerciseId ? [set.exerciseId] : []);
  const accessibleIds = await accessibleExerciseIds(exerciseIds, userId);
  if (accessibleIds.length !== new Set(exerciseIds).size) {
    return NextResponse.json({ error: "Exercise not found." }, { status: 404 });
  }

  const db = getDb();
  let routePoints = workoutValues.routePoints ?? null;
  let distanceM = workoutValues.distanceM ?? null;
  let durationSeconds = workoutValues.durationSeconds ?? null;
  let avgPaceSecPerKm = workoutValues.avgPaceSecPerKm ?? null;
  let elevationM = workoutValues.elevationM ?? null;

  if (workoutValues.type === "run" && routePoints?.length) {
    routePoints = sanitizeRunRoutePoints(routePoints);
    distanceM = Math.round(routeDistanceM(routePoints));
    durationSeconds ??= workoutValues.durationMin
      ? workoutValues.durationMin * 60
      : null;
    if (durationSeconds !== null) {
      avgPaceSecPerKm = averagePaceSecPerKm(durationSeconds, distanceM);
      workoutValues.durationMin = Math.max(1, Math.round(durationSeconds / 60));
    }
    const altitudes = routePoints.flatMap((point) =>
      point.altitudeM === null ? [] : [point.altitudeM],
    );
    if (altitudes.length > 1) {
      elevationM = Math.round(
        altitudes.slice(1).reduce((gain, altitude, index) => {
          const delta = altitude - altitudes[index];
          return gain + Math.max(delta, 0);
        }, 0),
      );
    }
  } else if (durationSeconds !== null && distanceM !== null) {
    avgPaceSecPerKm ??= averagePaceSecPerKm(durationSeconds, distanceM);
  }

  let caloriesBurned = workoutValues.caloriesBurned ?? null;
  let caloriesEstimated = workoutValues.caloriesEstimated;
  if (caloriesBurned === null && workoutValues.durationMin) {
    const [measurement] = await db
      .select({ weightKg: bodyMeasurements.weightKg })
      .from(bodyMeasurements)
      .where(
        and(
          eq(bodyMeasurements.userId, userId),
          lte(bodyMeasurements.loggedOn, workoutValues.loggedOn),
          isNotNull(bodyMeasurements.weightKg),
        ),
      )
      .orderBy(desc(bodyMeasurements.loggedOn), desc(bodyMeasurements.loggedAt))
      .limit(1);
    caloriesBurned = estimateWorkoutCalories(
      workoutValues.type,
      workoutValues.title ?? null,
      workoutValues.durationMin,
      measurement?.weightKg ?? null,
    );
    caloriesEstimated = caloriesBurned !== null;
  }

  const workoutId = crypto.randomUUID();
  const [workout] = await db
    .insert(workouts)
    .values({
      ...workoutValues,
      startedAt: startedAt ? new Date(startedAt) : null,
      durationSeconds,
      distanceM,
      avgPaceSecPerKm,
      elevationM,
      routePoints,
      caloriesBurned,
      caloriesEstimated,
      source: "manual",
      id: workoutId,
      userId,
    })
    .returning();
  let savedSets: Awaited<ReturnType<typeof workoutSetsFor>> = [];
  if (sets.length) {
    try {
      await db.insert(workoutSets).values(
        sets.map((set, index) => ({
          ...set,
          id: crypto.randomUUID(),
          workoutId,
          userId,
          orderIndex: index,
          setNumber: index + 1,
          completed: true,
        })),
      );
      savedSets = await workoutSetsFor(userId, [workoutId]);
    } catch (error) {
      try {
        await db
          .delete(workouts)
          .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)));
      } catch (cleanupError) {
        const errorType =
          cleanupError instanceof Error ? cleanupError.name : "UnknownError";
        console.error(`Workout rollback failed (${errorType}).`);
      }
      throw error;
    }
  }
  return NextResponse.json({ ...workout, sets: savedSets }, { status: 201 });
}

export const GET = withUser(listWorkouts);
export const POST = withUser(createWorkout);
