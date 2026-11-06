import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { exercises, workoutSets } from "@/lib/db/schema";

export async function accessibleExerciseIds(
  ids: string[],
  userId: string,
): Promise<string[]> {
  if (!ids.length) return [];
  const uniqueIds = [...new Set(ids)];
  const rows = await getDb()
    .select({ id: exercises.id })
    .from(exercises)
    .where(
      and(
        inArray(exercises.id, uniqueIds),
        or(isNull(exercises.userId), eq(exercises.userId, userId)),
      ),
    );
  return rows.map((row) => row.id);
}

export async function workoutSetsFor(userId: string, workoutIds: string[]) {
  if (!workoutIds.length) return [];
  return getDb()
    .select({
      id: workoutSets.id,
      workoutId: workoutSets.workoutId,
      exerciseId: workoutSets.exerciseId,
      exerciseName: exercises.name,
      orderIndex: workoutSets.orderIndex,
      setNumber: workoutSets.setNumber,
      reps: workoutSets.reps,
      weightKg: workoutSets.weightKg,
      durationS: workoutSets.durationS,
      distanceM: workoutSets.distanceM,
      rpe: workoutSets.rpe,
      isWarmup: workoutSets.isWarmup,
      completed: workoutSets.completed,
      createdAt: workoutSets.createdAt,
      updatedAt: workoutSets.updatedAt,
    })
    .from(workoutSets)
    .leftJoin(exercises, eq(workoutSets.exerciseId, exercises.id))
    .where(
      and(
        eq(workoutSets.userId, userId),
        inArray(workoutSets.workoutId, workoutIds),
      ),
    )
    .orderBy(workoutSets.orderIndex);
}
