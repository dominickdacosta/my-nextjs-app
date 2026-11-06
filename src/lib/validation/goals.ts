import { z } from "zod";
import { isDateString } from "@/lib/health/dates";

export const goalsSchema = z.object({
  effectiveFrom: z
    .string()
    .refine(isDateString, "Enter a valid effective date.")
    .optional(),
  caloriesKcal: z.number().int().min(0).max(10000),
  proteinG: z.number().int().min(0).max(1000),
  carbsG: z.number().int().min(0).max(1500),
  fatG: z.number().int().min(0).max(1000),
  fiberG: z.number().int().min(0).max(300),
  waterMl: z.number().int().min(0).max(20000),
  steps: z.number().int().min(0).max(100000),
  activeMinutes: z.number().int().min(0).max(1440),
  sleepMinutes: z.number().int().min(0).max(1440),
  workoutsPerWeek: z.number().int().min(0).max(50),
});

export type GoalsInput = z.infer<typeof goalsSchema>;
