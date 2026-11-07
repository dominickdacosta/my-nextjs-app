import { z } from "zod";

export const workoutTemplateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(1000).nullable().optional(),
  exercises: z.array(
    z.object({
      exerciseId: z.string().uuid(),
      targetSets: z.number().int().min(1).max(100),
      targetReps: z.number().int().min(0).max(1000),
      targetWeightKg: z.number().min(0).max(2000).nullable().optional(),
      restSeconds: z.number().int().min(0).max(3600).nullable().optional(),
    }),
  ).min(1).max(30),
});

export type WorkoutTemplateInput = z.infer<typeof workoutTemplateSchema>;
