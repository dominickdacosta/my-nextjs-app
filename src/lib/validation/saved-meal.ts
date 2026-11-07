import { z } from "zod";
import { isDateString } from "../health/dates";

export const savedMealSchema = z.object({
  name: z.string().trim().min(1).max(100),
  items: z.array(
    z.object({
      name: z.string().trim().min(1).max(160),
      servings: z.number().positive().max(100),
      kcal: z.number().min(0).max(10000),
      proteinG: z.number().min(0).max(1000).nullable(),
      carbsG: z.number().min(0).max(1500).nullable(),
      fatG: z.number().min(0).max(1000).nullable(),
      fiberG: z.number().min(0).max(300).nullable(),
      nutritionSource: z.enum(["estimated", "verified", "manual"]),
    }),
  ).min(1).max(50),
});

export const logSavedMealSchema = z.object({
  loggedOn: z.string().refine(isDateString, "Enter a valid log date."),
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
});
