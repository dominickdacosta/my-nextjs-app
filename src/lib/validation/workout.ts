import { z } from "zod";
import { isDateString } from "../health/dates";

const workoutSetSchema = z.object({
  exerciseId: z.string().uuid().nullable().optional(),
  reps: z.number().int().min(0).max(1000).nullable().optional(),
  weightKg: z.number().min(0).max(2000).nullable().optional(),
  durationS: z.number().int().min(0).max(86400).nullable().optional(),
  distanceM: z.number().int().min(0).max(1000000).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  isWarmup: z.boolean().default(false),
});

const routePointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  recordedAt: z.string().datetime(),
  accuracyM: z.number().min(0).max(1000),
  altitudeM: z.number().min(-1000).max(10000).nullable(),
});

export const workoutSchema = z.object({
  loggedOn: z.string().refine(isDateString, "Enter a valid log date."),
  type: z.enum(["strength", "cardio", "walk", "run", "other"]),
  title: z.string().trim().max(160).nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  durationMin: z.number().int().min(1).max(1440).nullable().optional(),
  durationSeconds: z.number().int().min(1).max(86400).nullable().optional(),
  distanceM: z.number().int().min(0).max(1000000).nullable().optional(),
  steps: z.number().int().min(0).max(100000).nullable().optional(),
  avgHeartRate: z.number().int().min(30).max(250).nullable().optional(),
  caloriesBurned: z.number().int().min(0).max(10000).nullable().optional(),
  caloriesEstimated: z.boolean().default(false),
  avgPaceSecPerKm: z.number().int().min(1).max(86400).nullable().optional(),
  elevationM: z.number().int().min(0).max(100000).nullable().optional(),
  routePoints: z.array(routePointSchema).max(2500).nullable().optional(),
  routePolyline: z.string().max(100000).nullable().optional(),
  perceivedEffort: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  sets: z.array(workoutSetSchema).max(100).default([]),
});

const workoutSetRestoreSchema = workoutSetSchema.extend({
  id: z.string().uuid(),
});

export const workoutRestoreSchema = workoutSchema.extend({
  loggedAt: z.string().datetime(),
  source: z.string().max(40).nullable().optional(),
  externalActivityId: z.string().max(100).nullable().optional(),
  sets: z.array(workoutSetRestoreSchema).max(100).default([]),
});

export type WorkoutInput = z.infer<typeof workoutSchema>;
