import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidInput, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  bodyMeasurements,
  dailyActivity,
  dailyCheckins,
  exercises,
  favoriteFoods,
  foodEntries,
  foods,
  goals,
  medicationLogs,
  medications,
  profiles,
  reminders,
  savedMealItems,
  savedMeals,
  sleepEntries,
  vitals,
  waterEntries,
  workoutSets,
  workoutTemplateExercises,
  workoutTemplates,
  workouts,
} from "@/lib/db/schema";
import { profileUpdateSchema } from "@/lib/validation/profile";

const valueSchema = z.union([
  z.string().max(10_000),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string().max(10_000), z.number().finite(), z.boolean(), z.null()])).max(2_000),
]);
const rowSchema = z.record(z.string().max(64), valueSchema);
const backupSchema = z.object({
  format: z.literal("vitals-backup"),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  data: z.object({
    profiles: z.array(rowSchema).max(1),
    goals: z.array(rowSchema).max(10_000),
    foods: z.array(rowSchema).max(10_000),
    foodEntries: z.array(rowSchema).max(10_000),
    favoriteFoods: z.array(rowSchema).max(10_000),
    savedMeals: z.array(rowSchema).max(10_000),
    savedMealItems: z.array(rowSchema).max(10_000),
    waterEntries: z.array(rowSchema).max(10_000),
    workouts: z.array(rowSchema).max(10_000),
    workoutSets: z.array(rowSchema).max(50_000),
    exercises: z.array(rowSchema).max(10_000),
    workoutTemplates: z.array(rowSchema).max(10_000),
    workoutTemplateExercises: z.array(rowSchema).max(50_000),
    dailyActivity: z.array(rowSchema).max(10_000),
    bodyMeasurements: z.array(rowSchema).max(10_000),
    vitals: z.array(rowSchema).max(10_000),
    sleepEntries: z.array(rowSchema).max(10_000),
    dailyCheckins: z.array(rowSchema).max(10_000),
    medications: z.array(rowSchema).max(10_000),
    medicationLogs: z.array(rowSchema).max(50_000),
    reminders: z.array(rowSchema).max(10_000),
  }).strict(),
}).strict();

type BackupRow = z.infer<typeof rowSchema>;
type NormalizedBackupRow = Record<string, BackupRow[string] | Date>;
type BackupData = z.infer<typeof backupSchema>["data"];
type BackupTable = Exclude<keyof BackupData, "profiles">;

const allowedFields: Record<keyof BackupData, ReadonlySet<string>> = {
  profiles: new Set([
    "userId", "displayName", "sex", "birthDate", "heightCm", "activityLevel",
    "goalType", "targetWeightKg", "weeklyRateKg", "unitSystem", "timezone",
    "hideCalories", "onboardedAt", "createdAt", "updatedAt",
  ]),
  goals: new Set(["id", "userId", "effectiveFrom", "caloriesKcal", "proteinG", "carbsG", "fatG", "fiberG", "waterMl", "steps", "activeMinutes", "sleepMinutes", "workoutsPerWeek", "createdAt", "updatedAt"]),
  foods: new Set(["id", "userId", "source", "externalId", "barcode", "name", "brand", "servingSize", "servingUnit", "gramsPerServing", "kcal", "proteinG", "carbsG", "fatG", "fiberG", "sugarG", "sodiumMg", "createdAt", "updatedAt"]),
  foodEntries: new Set(["id", "userId", "loggedOn", "loggedAt", "meal", "foodId", "name", "servings", "kcal", "proteinG", "carbsG", "fatG", "fiberG", "sugarG", "sodiumMg", "notes", "createdAt", "updatedAt"]),
  favoriteFoods: new Set(["id", "userId", "foodId", "createdAt", "updatedAt"]),
  savedMeals: new Set(["id", "userId", "name", "createdAt", "updatedAt"]),
  savedMealItems: new Set(["id", "userId", "savedMealId", "foodId", "name", "servings", "kcal", "proteinG", "carbsG", "fatG", "fiberG", "sugarG", "sodiumMg", "createdAt", "updatedAt"]),
  waterEntries: new Set(["id", "userId", "loggedOn", "loggedAt", "amountMl", "createdAt", "updatedAt"]),
  workouts: new Set(["id", "userId", "loggedOn", "loggedAt", "type", "title", "startedAt", "durationMin", "distanceM", "steps", "avgHeartRate", "caloriesBurned", "caloriesEstimated", "perceivedEffort", "notes", "templateId", "source", "createdAt", "updatedAt"]),
  workoutSets: new Set(["id", "userId", "workoutId", "exerciseId", "orderIndex", "setNumber", "reps", "weightKg", "durationS", "distanceM", "rpe", "isWarmup", "completed", "createdAt", "updatedAt"]),
  exercises: new Set(["id", "userId", "name", "category", "primaryMuscle", "equipment", "metValue", "tracks", "createdAt", "updatedAt"]),
  workoutTemplates: new Set(["id", "userId", "name", "notes", "createdAt", "updatedAt"]),
  workoutTemplateExercises: new Set(["id", "userId", "templateId", "exerciseId", "orderIndex", "targetSets", "targetReps", "targetWeightKg", "restSeconds", "createdAt", "updatedAt"]),
  dailyActivity: new Set(["id", "userId", "loggedOn", "loggedAt", "steps", "activeMinutes", "distanceM", "source", "createdAt", "updatedAt"]),
  bodyMeasurements: new Set(["id", "userId", "loggedOn", "loggedAt", "weightKg", "bodyFatPct", "waistCm", "hipCm", "chestCm", "armCm", "thighCm", "notes", "createdAt", "updatedAt"]),
  vitals: new Set(["id", "userId", "loggedOn", "loggedAt", "kind", "valuePrimary", "valueSecondary", "unit", "context", "measuredAt", "createdAt", "updatedAt"]),
  sleepEntries: new Set(["id", "userId", "loggedOn", "loggedAt", "sleepDate", "bedAt", "wakeAt", "durationMin", "quality", "awakenings", "notes", "createdAt", "updatedAt"]),
  dailyCheckins: new Set(["id", "userId", "loggedOn", "loggedAt", "mood", "energy", "stress", "soreness", "symptoms", "notes", "createdAt", "updatedAt"]),
  medications: new Set(["id", "userId", "name", "dose", "schedule", "times", "daysOfWeek", "active", "createdAt", "updatedAt"]),
  medicationLogs: new Set(["id", "userId", "medicationId", "loggedOn", "scheduledFor", "status", "loggedAt", "createdAt", "updatedAt"]),
  reminders: new Set(["id", "userId", "kind", "time", "daysOfWeek", "enabled", "pushSubscriptionId", "createdAt", "updatedAt"]),
};

const timestampFields = new Set([
  "onboardedAt", "createdAt", "updatedAt", "loggedAt", "startedAt", "bedAt",
  "wakeAt", "measuredAt", "scheduledFor",
]);

function normalizeRow(table: keyof BackupData, row: BackupRow): NormalizedBackupRow {
  const allowed = allowedFields[table];
  if (Object.keys(row).some((key) => !allowed.has(key))) {
    throw new Error("Backup contains unsupported fields.");
  }
  const normalized: NormalizedBackupRow = { ...row };
  for (const [key, value] of Object.entries(normalized)) {
    if (timestampFields.has(key) && typeof value === "string") {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new Error("Backup contains an invalid timestamp.");
      }
      normalized[key] = date;
    }
  }
  return normalized;
}

async function insertRows<T extends PgTable>(
  table: T,
  rows: BackupRow[],
  tableName: BackupTable,
  userId: string,
) {
  if (!rows.length) return;
  const values = rows.map((row) => ({
    ...normalizeRow(tableName, row),
    userId,
    ...(tableName === "reminders" ? { pushSubscriptionId: null } : {}),
  })) as T["$inferInsert"][];
  await getDb().insert(table).values(values).onConflictDoNothing();
}

function ids(rows: BackupRow[]): string[] {
  return rows.flatMap((row) =>
    typeof row.id === "string" ? [row.id] : [],
  );
}

async function readBackupBody(request: Request, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export const POST = withUser(async (request, userId) => {
  const maxBytes = 10 * 1024 * 1024;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    return NextResponse.json({ error: "Backup file is too large." }, { status: 413 });
  }
  const bodyText = await readBackupBody(request, maxBytes);
  if (bodyText === null) {
    return NextResponse.json({ error: "Backup file is too large." }, { status: 413 });
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(bodyText);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Backup must be valid JSON." }, { status: 400 });
    }
    throw error;
  }
  const result = backupSchema.safeParse(parsedJson);
  if (!result.success) return invalidInput(result.error.issues);
  const data = result.data.data;
  const sourceUserId = data.profiles[0]?.userId;
  if (typeof sourceUserId !== "string") {
    return NextResponse.json({ error: "Backup profile is missing." }, { status: 400 });
  }
  const profile = data.profiles[0];
  const profileResult = profileUpdateSchema.safeParse({
    displayName: profile.displayName,
    sex: profile.sex,
    birthDate: profile.birthDate,
    heightCm: profile.heightCm,
    activityLevel: profile.activityLevel,
    goalType: profile.goalType,
    targetWeightKg: profile.targetWeightKg,
    weeklyRateKg: profile.weeklyRateKg,
    unitSystem: profile.unitSystem,
    timezone: profile.timezone,
    hideCalories: profile.hideCalories,
  });
  if (!profileResult.success) return invalidInput(profileResult.error.issues);
  if (sourceUserId !== userId) {
    const [sourceUser] = await getDb()
      .select({ id: profiles.userId })
      .from(profiles)
      .where(eq(profiles.userId, sourceUserId))
      .limit(1);
    if (sourceUser) {
      return NextResponse.json(
        { error: "Delete the source account before restoring its backup to another account." },
        { status: 409 },
      );
    }
  }

  for (const [tableName, rows] of Object.entries(data) as Array<[keyof BackupData, BackupRow[]]>) {
    if (rows.some((row) => Object.keys(row).some((key) => !allowedFields[tableName].has(key)))) {
      return NextResponse.json({ error: "Backup contains unsupported fields." }, { status: 400 });
    }
    if (rows.some((row) =>
      Object.entries(row).some(([key, value]) =>
        timestampFields.has(key) &&
        typeof value === "string" &&
        Number.isNaN(new Date(value).getTime()),
      ),
    )) {
      return NextResponse.json({ error: "Backup contains an invalid timestamp." }, { status: 400 });
    }
    if (tableName !== "profiles" && rows.some((row) => typeof row.id !== "string" || !z.string().uuid().safeParse(row.id).success)) {
      return NextResponse.json({ error: "Backup contains an invalid record ID." }, { status: 400 });
    }
    if (rows.some((row) => Object.entries(row).some(([key, value]) =>
      key !== "userId" &&
      key !== "externalId" &&
      key !== "pushSubscriptionId" &&
      key.endsWith("Id") &&
      typeof value === "string" &&
      !z.string().uuid().safeParse(value).success,
    ))) {
      return NextResponse.json({ error: "Backup contains an invalid reference ID." }, { status: 400 });
    }
  }

  const db = getDb();
  const [backupProfile] = data.profiles;
  const normalizedProfile = normalizeRow("profiles", backupProfile);
  const profileValues = {
    ...normalizedProfile,
    userId,
  } as typeof profiles.$inferInsert;
  const { userId: profileOwner, ...profileChanges } = profileValues;
  if (profileOwner !== userId) throw new Error("Profile owner did not match session.");
  await db.insert(profiles)
    .values(profileValues)
    .onConflictDoUpdate({ target: profiles.userId, set: profileChanges });

  const safeExerciseIds = new Set<string>();
  const requestedExerciseIds = data.exercises.flatMap((row) => typeof row.id === "string" ? [row.id] : []);
  if (requestedExerciseIds.length) {
    const safeRows = await db.select({ id: exercises.id })
      .from(exercises)
      .where(and(
        inArray(exercises.id, requestedExerciseIds),
        or(isNull(exercises.userId), eq(exercises.userId, userId)),
      ));
    safeRows.forEach((row) => safeExerciseIds.add(row.id));
  }
  await insertRows(exercises, data.exercises.filter((row) => row.userId !== null), "exercises", userId);
  const insertedExerciseRows = requestedExerciseIds.length
    ? await db.select({ id: exercises.id })
        .from(exercises)
        .where(and(inArray(exercises.id, requestedExerciseIds), eq(exercises.userId, userId)))
    : [];
  insertedExerciseRows.forEach((row) => safeExerciseIds.add(row.id));

  await insertRows(foods, data.foods, "foods", userId);
  await insertRows(goals, data.goals, "goals", userId);
  await insertRows(savedMeals, data.savedMeals, "savedMeals", userId);
  await insertRows(workoutTemplates, data.workoutTemplates, "workoutTemplates", userId);
  await insertRows(medications, data.medications, "medications", userId);
  const safeFoodIds = new Set<string>();
  const foodIds = ids(data.foods);
  if (foodIds.length) {
    const rows = await db.select({ id: foods.id }).from(foods)
      .where(and(inArray(foods.id, foodIds), eq(foods.userId, userId)));
    rows.forEach((row) => safeFoodIds.add(row.id));
  }
  const safeMealIds = new Set<string>();
  const mealIds = ids(data.savedMeals);
  if (mealIds.length) {
    const rows = await db.select({ id: savedMeals.id }).from(savedMeals)
      .where(and(inArray(savedMeals.id, mealIds), eq(savedMeals.userId, userId)));
    rows.forEach((row) => safeMealIds.add(row.id));
  }
  const safeTemplateIds = new Set<string>();
  const templateIds = ids(data.workoutTemplates);
  if (templateIds.length) {
    const rows = await db.select({ id: workoutTemplates.id }).from(workoutTemplates)
      .where(and(inArray(workoutTemplates.id, templateIds), eq(workoutTemplates.userId, userId)));
    rows.forEach((row) => safeTemplateIds.add(row.id));
  }
  const safeMedicationIds = new Set<string>();
  const medicationIds = ids(data.medications);
  if (medicationIds.length) {
    const rows = await db.select({ id: medications.id }).from(medications)
      .where(and(inArray(medications.id, medicationIds), eq(medications.userId, userId)));
    rows.forEach((row) => safeMedicationIds.add(row.id));
  }

  await insertRows(favoriteFoods, data.favoriteFoods.filter((row) => typeof row.foodId === "string" && safeFoodIds.has(row.foodId)), "favoriteFoods", userId);
  await insertRows(savedMealItems, data.savedMealItems.flatMap((row) => {
    if (typeof row.savedMealId !== "string" || !safeMealIds.has(row.savedMealId)) return [];
    return [{
      ...row,
      foodId: typeof row.foodId === "string" && safeFoodIds.has(row.foodId) ? row.foodId : null,
    }];
  }), "savedMealItems", userId);
  await insertRows(foodEntries, data.foodEntries.map((row) => ({
    ...row,
    foodId: typeof row.foodId === "string" && safeFoodIds.has(row.foodId) ? row.foodId : null,
  })), "foodEntries", userId);
  await insertRows(waterEntries, data.waterEntries, "waterEntries", userId);
  await insertRows(workouts, data.workouts.map((row) => ({
    ...row,
    templateId: typeof row.templateId === "string" && safeTemplateIds.has(row.templateId) ? row.templateId : null,
  })), "workouts", userId);
  const safeWorkoutIds = new Set<string>();
  const workoutIds = ids(data.workouts);
  if (workoutIds.length) {
    const rows = await db.select({ id: workouts.id }).from(workouts)
      .where(and(inArray(workouts.id, workoutIds), eq(workouts.userId, userId)));
    rows.forEach((row) => safeWorkoutIds.add(row.id));
  }
  await insertRows(workoutSets, data.workoutSets.flatMap((row) => {
    if (typeof row.workoutId !== "string" || !safeWorkoutIds.has(row.workoutId)) return [];
    return [{
      ...row,
      exerciseId: typeof row.exerciseId === "string" && safeExerciseIds.has(row.exerciseId) ? row.exerciseId : null,
    }];
  }), "workoutSets", userId);
  await insertRows(workoutTemplateExercises, data.workoutTemplateExercises.filter((row) =>
    typeof row.templateId === "string" &&
    safeTemplateIds.has(row.templateId) &&
    typeof row.exerciseId === "string" &&
    safeExerciseIds.has(row.exerciseId),
  ), "workoutTemplateExercises", userId);
  await insertRows(dailyActivity, data.dailyActivity, "dailyActivity", userId);
  await insertRows(bodyMeasurements, data.bodyMeasurements, "bodyMeasurements", userId);
  await insertRows(vitals, data.vitals, "vitals", userId);
  await insertRows(sleepEntries, data.sleepEntries, "sleepEntries", userId);
  await insertRows(dailyCheckins, data.dailyCheckins, "dailyCheckins", userId);
  await insertRows(medicationLogs, data.medicationLogs.filter((row) =>
    typeof row.medicationId === "string" && safeMedicationIds.has(row.medicationId),
  ), "medicationLogs", userId);
  await insertRows(reminders, data.reminders, "reminders", userId);

  return NextResponse.json(
    { imported: true, remindersRequirePushSetup: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
