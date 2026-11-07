import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import {
  exercises,
  workoutTemplateExercises,
  workoutTemplates,
} from "@/lib/db/schema";
import { accessibleExerciseIds } from "@/lib/health/workout-queries";
import { workoutTemplateSchema } from "@/lib/validation/workout-template";

export const GET = withUser(async (_request, userId) => {
  const db = getDb();
  const templates = await db
    .select()
    .from(workoutTemplates)
    .where(eq(workoutTemplates.userId, userId))
    .orderBy(workoutTemplates.createdAt);
  if (!templates.length) return NextResponse.json([]);

  const templateIds = templates.map((template) => template.id);
  const exerciseRows = await db
    .select()
    .from(workoutTemplateExercises)
    .where(
      and(
        eq(workoutTemplateExercises.userId, userId),
        inArray(workoutTemplateExercises.templateId, templateIds),
      ),
    )
    .orderBy(workoutTemplateExercises.orderIndex);
  const exerciseIds = [...new Set(exerciseRows.map((row) => row.exerciseId))];
  const exerciseDetails = exerciseIds.length
    ? await db
        .select({ id: exercises.id, name: exercises.name })
        .from(exercises)
        .where(
          and(
            inArray(exercises.id, exerciseIds),
            or(isNull(exercises.userId), eq(exercises.userId, userId)),
          ),
        )
    : [];
  return NextResponse.json(
    templates.map((template) => ({
      ...template,
      exercises: exerciseRows
        .filter((row) => row.templateId === template.id)
        .flatMap((row) => {
          const exercise = exerciseDetails.find((item) => item.id === row.exerciseId);
          return exercise ? [{ ...row, name: exercise.name }] : [];
        }),
    })),
  );
});

export const POST = withUser(async (request, userId) => {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = workoutTemplateSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);

  const { exercises: templateExercises, ...templateValues } = result.data;
  const exerciseIds = templateExercises.map((exercise) => exercise.exerciseId);
  const accessibleIds = await accessibleExerciseIds(exerciseIds, userId);
  if (accessibleIds.length !== new Set(exerciseIds).size) {
    return NextResponse.json({ error: "Exercise not found." }, { status: 404 });
  }

  const db = getDb();
  const templateId = crypto.randomUUID();
  const [template] = await db
    .insert(workoutTemplates)
    .values({ ...templateValues, id: templateId, userId })
    .returning();
  try {
    await db.insert(workoutTemplateExercises).values(
      templateExercises.map((exercise, index) => ({
        ...exercise,
        id: crypto.randomUUID(),
        templateId,
        userId,
        orderIndex: index,
      })),
    );
  } catch (error) {
    try {
      await db
        .delete(workoutTemplates)
        .where(and(eq(workoutTemplates.id, templateId), eq(workoutTemplates.userId, userId)));
    } catch (cleanupError) {
      const errorType =
        cleanupError instanceof Error ? cleanupError.name : "UnknownError";
      console.error(`Workout template rollback failed (${errorType}).`);
    }
    throw error;
  }
  return NextResponse.json(
    { ...template, exercises: templateExercises },
    { status: 201 },
  );
});
