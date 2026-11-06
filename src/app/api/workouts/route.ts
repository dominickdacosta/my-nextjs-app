import {
  and,
  desc,
  eq,
  gte,
  lte,
} from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { workoutSets, workouts } from "@/lib/db/schema";
import { isDateString } from "@/lib/health/dates";
import {
  accessibleExerciseIds,
  workoutSetsFor,
} from "@/lib/health/workout-queries";
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

  const { sets, ...workoutValues } = result.data;
  const exerciseIds = sets.flatMap((set) => set.exerciseId ? [set.exerciseId] : []);
  const accessibleIds = await accessibleExerciseIds(exerciseIds, userId);
  if (accessibleIds.length !== new Set(exerciseIds).size) {
    return NextResponse.json({ error: "Exercise not found." }, { status: 404 });
  }

  const db = getDb();
  const workoutId = crypto.randomUUID();
  const [workout] = await db
    .insert(workouts)
    .values({ ...workoutValues, id: workoutId, userId })
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
