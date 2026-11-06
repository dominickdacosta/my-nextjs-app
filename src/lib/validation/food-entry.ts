import { z } from "zod";
import { isDateString } from "../health/dates";

export const foodEntrySchema = z.object({
  loggedOn: z.string().refine(isDateString, "Enter a valid log date."),
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  name: z.string().trim().min(1).max(160),
  servings: z.number().positive().max(100).default(1),
  kcal: z.number().min(0).max(10000).default(0),
  proteinG: z.number().min(0).max(1000).nullable().optional(),
  carbsG: z.number().min(0).max(1500).nullable().optional(),
  fatG: z.number().min(0).max(1000).nullable().optional(),
  fiberG: z.number().min(0).max(300).nullable().optional(),
  sugarG: z.number().min(0).max(1000).nullable().optional(),
  sodiumMg: z.number().min(0).max(100000).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const foodRestoreSchema = foodEntrySchema.extend({
  loggedAt: z.string().datetime(),
});

export type FoodEntryInput = z.infer<typeof foodEntrySchema>;
