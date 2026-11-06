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

export const workoutSchema = z.object({
  loggedOn: z.string().refine(isDateString, "Enter a valid log date."),
  type: z.enum(["strength", "cardio", "walk", "run", "other"]),
  title: z.string().trim().max(160).nullable().optional(),
  durationMin: z.number().int().min(1).max(1440).nullable().optional(),
  distanceM: z.number().int().min(0).max(1000000).nullable().optional(),
  steps: z.number().int().min(0).max(100000).nullable().optional(),
  avgHeartRate: z.number().int().min(30).max(250).nullable().optional(),
  caloriesBurned: z.number().int().min(0).max(10000).nullable().optional(),
  caloriesEstimated: z.boolean().default(false),
  perceivedEffort: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  sets: z.array(workoutSetSchema).max(100).default([]),
});

const workoutSetRestoreSchema = workoutSetSchema.extend({
  id: z.string().uuid(),
});

export const workoutRestoreSchema = workoutSchema.extend({
  loggedAt: z.string().datetime(),
  sets: z.array(workoutSetRestoreSchema).max(100).default([]),
});

export type WorkoutInput = z.infer<typeof workoutSchema>;
