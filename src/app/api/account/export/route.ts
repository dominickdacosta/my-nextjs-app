import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
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
import { todayFor } from "@/lib/health/dates";

export const GET = withUser(async (_request, userId) => {
  const db = getDb();
  const [
    profileRows,
    goalRows,
    ownedFoods,
    foodEntryRows,
    favoriteFoodRows,
    savedMealRows,
    savedMealItemRows,
    waterRows,
    workoutRows,
    workoutSetRows,
    templateRows,
    templateExerciseRows,
    activityRows,
    measurementRows,
    vitalRows,
    sleepRows,
    checkinRows,
    medicationRows,
    medicationLogRows,
    reminderRows,
  ] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, userId)),
    db.select().from(goals).where(eq(goals.userId, userId)),
    db.select().from(foods).where(eq(foods.userId, userId)),
    db.select().from(foodEntries).where(eq(foodEntries.userId, userId)),
    db.select().from(favoriteFoods).where(eq(favoriteFoods.userId, userId)),
    db.select().from(savedMeals).where(eq(savedMeals.userId, userId)),
    db.select().from(savedMealItems).where(eq(savedMealItems.userId, userId)),
    db.select().from(waterEntries).where(eq(waterEntries.userId, userId)),
    db.select().from(workouts).where(eq(workouts.userId, userId)),
    db.select().from(workoutSets).where(eq(workoutSets.userId, userId)),
    db.select().from(workoutTemplates).where(eq(workoutTemplates.userId, userId)),
    db.select()
      .from(workoutTemplateExercises)
      .where(eq(workoutTemplateExercises.userId, userId)),
    db.select().from(dailyActivity).where(eq(dailyActivity.userId, userId)),
    db.select().from(bodyMeasurements).where(eq(bodyMeasurements.userId, userId)),
    db.select().from(vitals).where(eq(vitals.userId, userId)),
    db.select().from(sleepEntries).where(eq(sleepEntries.userId, userId)),
    db.select().from(dailyCheckins).where(eq(dailyCheckins.userId, userId)),
    db.select().from(medications).where(eq(medications.userId, userId)),
    db.select().from(medicationLogs).where(eq(medicationLogs.userId, userId)),
    db.select().from(reminders).where(eq(reminders.userId, userId)),
  ]);
  const profile = profileRows[0];
  const referencedExerciseIds = [
    ...new Set([
      ...workoutSetRows.flatMap((row) => row.exerciseId ? [row.exerciseId] : []),
      ...templateExerciseRows.map((row) => row.exerciseId),
    ]),
  ];
  const exerciseRows = referencedExerciseIds.length
    ? await db
        .select()
        .from(exercises)
        .where(and(
          inArray(exercises.id, referencedExerciseIds),
          or(isNull(exercises.userId), eq(exercises.userId, userId)),
        ))
    : [];
  const day = profile ? todayFor(profile.timezone) : new Date().toISOString().slice(0, 10);
  const filename = `vitals-backup-${day}.json`;
  return NextResponse.json(
    {
      format: "vitals-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        profiles: profileRows,
        goals: goalRows,
        foods: ownedFoods,
        foodEntries: foodEntryRows,
        favoriteFoods: favoriteFoodRows,
        savedMeals: savedMealRows,
        savedMealItems: savedMealItemRows,
        waterEntries: waterRows,
        workouts: workoutRows,
        workoutSets: workoutSetRows,
        exercises: exerciseRows,
        workoutTemplates: templateRows,
        workoutTemplateExercises: templateExerciseRows,
        dailyActivity: activityRows,
        bodyMeasurements: measurementRows,
        vitals: vitalRows,
        sleepEntries: sleepRows,
        dailyCheckins: checkinRows,
        medications: medicationRows,
        medicationLogs: medicationLogRows,
        reminders: reminderRows,
      },
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
});
