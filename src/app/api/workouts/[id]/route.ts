import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { workoutSets, workouts } from "@/lib/db/schema";
import {
  accessibleExerciseIds,
  workoutSetsFor,
} from "@/lib/health/workout-queries";
import { workoutRestoreSchema } from "@/lib/validation/workout";

function workoutId(request: Request): string | null {
  const id = new URL(request.url).pathname.split("/").at(-1);
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

async function deleteWorkout(request: Request, userId: string) {
  const id = workoutId(request);
  if (!id) {
    return NextResponse.json({ error: "Invalid workout ID." }, { status: 400 });
  }
  const db = getDb();
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
    .limit(1);
  if (!workout) {
    return NextResponse.json({ error: "Workout not found." }, { status: 404 });
  }
  const sets = await workoutSetsFor(userId, [id]);
  const [deleted] = await db
    .delete(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
    .returning();
  if (!deleted) {
    return NextResponse.json({ error: "Workout not found." }, { status: 404 });
  }
  return NextResponse.json({ ...deleted, sets });
}

async function restoreWorkout(request: Request, userId: string) {
  const id = workoutId(request);
  if (!id) {
    return NextResponse.json({ error: "Invalid workout ID." }, { status: 400 });
  }
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = workoutRestoreSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);

  const { loggedAt, sets, ...workoutValues } = result.data;
  const exerciseIds = sets.flatMap((set) => set.exerciseId ? [set.exerciseId] : []);
  const accessibleIds = await accessibleExerciseIds(exerciseIds, userId);
  if (accessibleIds.length !== new Set(exerciseIds).size) {
    return NextResponse.json({ error: "Exercise not found." }, { status: 404 });
  }

  const db = getDb();
  const [workout] = await db
    .insert(workouts)
    .values({
      ...workoutValues,
      id,
      loggedAt: new Date(loggedAt),
      userId,
    })
    .onConflictDoNothing()
    .returning();
  if (!workout) {
    const [existing] = await db
      .select()
      .from(workouts)
      .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Workout not found." }, { status: 404 });
    }
    return NextResponse.json({
      ...existing,
      sets: await workoutSetsFor(userId, [id]),
    });
  }

  if (sets.length) {
    try {
      await db.insert(workoutSets).values(
        sets.map((set, index) => ({
          ...set,
          workoutId: id,
          userId,
          orderIndex: index,
          setNumber: index + 1,
          completed: true,
        })),
      );
    } catch (error) {
      try {
        await db
          .delete(workouts)
          .where(and(eq(workouts.id, id), eq(workouts.userId, userId)));
      } catch (cleanupError) {
        const errorType =
          cleanupError instanceof Error ? cleanupError.name : "UnknownError";
        console.error(`Workout rollback failed (${errorType}).`);
      }
      throw error;
    }
  }
  return NextResponse.json({
    ...workout,
    sets: await workoutSetsFor(userId, [id]),
  });
}

export const DELETE = withUser(deleteWorkout);
export const POST = withUser(restoreWorkout);
