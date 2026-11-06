import { createHash } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db/client";
import {
  bodyMeasurements,
  dailyActivity,
  dailyCheckins,
  foodEntries,
  profiles,
  sleepEntries,
  users,
  waterEntries,
  workouts,
} from "../src/lib/db/schema";
import { addDays, todayFor } from "../src/lib/health/dates";

loadEnvConfig(process.cwd());

function stableId(value: string): string {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function atTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}

async function seedDevelopmentData() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development sample data cannot be seeded in production.");
  }
  const userId = process.env.DEV_SEED_USER_ID;
  if (!userId) throw new Error("Set DEV_SEED_USER_ID to an existing account ID.");

  const db = getDb();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("DEV_SEED_USER_ID must match an existing account.");

  const [profile] = await db
    .select({ timezone: profiles.timezone })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) throw new Error("The sample account must complete onboarding first.");

  const today = todayFor(profile.timezone);
  const activities: (typeof dailyActivity.$inferInsert)[] = [];
  const checkins: (typeof dailyCheckins.$inferInsert)[] = [];
  const water: (typeof waterEntries.$inferInsert)[] = [];
  const meals: (typeof foodEntries.$inferInsert)[] = [];
  const measurements: (typeof bodyMeasurements.$inferInsert)[] = [];
  const sleep: (typeof sleepEntries.$inferInsert)[] = [];
  const sessions: (typeof workouts.$inferInsert)[] = [];

  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const loggedAt = atTime(date, "12:00");
    const seedKey = `${userId}:${date}`;

    activities.push({
      id: stableId(`${seedKey}:activity`),
      userId,
      loggedOn: date,
      loggedAt,
      steps: 5200 + ((offset * 317) % 6500),
      activeMinutes: 20 + ((offset * 7) % 55),
      distanceM: 3800 + ((offset * 211) % 5200),
      source: "sample",
    });
    checkins.push({
      id: stableId(`${seedKey}:checkin`),
      userId,
      loggedOn: date,
      loggedAt,
      mood: 3 + (offset % 3),
      energy: 2 + ((offset + 1) % 4),
      stress: 1 + (offset % 3),
      soreness: 1 + ((offset + 2) % 3),
      symptoms: [],
      notes: "Sample check-in",
    });

    for (const [glass, amountMl] of [250, 350, 250, 300].entries()) {
      water.push({
        id: stableId(`${seedKey}:water:${glass}`),
        userId,
        loggedOn: date,
        loggedAt: new Date(loggedAt.getTime() + glass * 60000),
        amountMl,
      });
    }

    const mealSamples = [
      { meal: "breakfast", name: "Oatmeal with berries", kcal: 360, proteinG: 14 },
      { meal: "lunch", name: "Grain bowl with tofu", kcal: 520, proteinG: 28 },
      { meal: "dinner", name: "Salmon, rice and vegetables", kcal: 640, proteinG: 38 },
    ];
    for (const [index, meal] of mealSamples.entries()) {
      meals.push({
        id: stableId(`${seedKey}:meal:${index}`),
        userId,
        loggedOn: date,
        loggedAt: new Date(loggedAt.getTime() + index * 3_600_000),
        meal: meal.meal,
        name: meal.name,
        servings: 1,
        kcal: meal.kcal,
        proteinG: meal.proteinG,
        carbsG: 55,
        fatG: 16,
        fiberG: 8,
        notes: "Sample entry",
      });
    }

    if (offset % 5 === 0) {
      measurements.push({
        id: stableId(`${seedKey}:weight`),
        userId,
        loggedOn: date,
        loggedAt,
        weightKg: 68.5 + offset * 0.025,
      });
    }

    const sleepDate = addDays(date, -1);
    sleep.push({
      id: stableId(`${seedKey}:sleep`),
      userId,
      loggedOn: date,
      loggedAt: atTime(date, "07:00"),
      sleepDate,
      bedAt: atTime(sleepDate, "22:30"),
      wakeAt: atTime(date, "06:45"),
      durationMin: 495 + ((offset % 5) - 2) * 15,
      quality: 3 + (offset % 3),
      awakenings: offset % 3,
    });

    if (offset % 3 === 0) {
      sessions.push({
        id: stableId(`${seedKey}:workout`),
        userId,
        loggedOn: date,
        loggedAt,
        type: "walk",
        title: "Neighborhood walk",
        startedAt: atTime(date, "17:30"),
        durationMin: 30 + (offset % 4) * 5,
        distanceM: 3000 + (offset % 4) * 450,
        steps: 4200 + (offset % 4) * 600,
        caloriesBurned: 150 + (offset % 4) * 25,
        caloriesEstimated: true,
        source: "sample",
      });
    }
  }

  if (activities.length) await db.insert(dailyActivity).values(activities).onConflictDoNothing();
  if (checkins.length) await db.insert(dailyCheckins).values(checkins).onConflictDoNothing();
  if (water.length) await db.insert(waterEntries).values(water).onConflictDoNothing();
  if (meals.length) await db.insert(foodEntries).values(meals).onConflictDoNothing();
  if (measurements.length) await db.insert(bodyMeasurements).values(measurements).onConflictDoNothing();
  if (sleep.length) await db.insert(sleepEntries).values(sleep).onConflictDoNothing();
  if (sessions.length) await db.insert(workouts).values(sessions).onConflictDoNothing();
}

seedDevelopmentData().catch((error: unknown) => {
  const errorType = error instanceof Error ? error.name : "UnknownError";
  console.error(`Development seed failed (${errorType}).`);
  process.exitCode = 1;
});
