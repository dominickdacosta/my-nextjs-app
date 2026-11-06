import { z } from "zod";
import { isDateString } from "@/lib/health/dates";

const timezoneSchema = z.string().min(1).refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}, "Enter a valid IANA timezone.");

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  sex: z.enum(["female", "male", "other", "prefer_not"]),
  birthDate: z
    .string()
    .refine(isDateString, "Enter a valid birth date.")
    .refine(
      (value) => value <= new Date().toISOString().slice(0, 10),
      "Birth date cannot be in the future.",
    ),
  heightCm: z.number().positive().max(300),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goalType: z.enum(["lose", "maintain", "gain"]),
  targetWeightKg: z.number().positive().max(700).nullable().optional(),
  weeklyRateKg: z.number().min(0).max(2),
  unitSystem: z.enum(["metric", "imperial"]),
  timezone: timezoneSchema,
  hideCalories: z.boolean().default(false),
  currentWeightKg: z.number().positive().max(700).optional(),
});

export const profileUpdateSchema = profileSchema.omit({ currentWeightKg: true });

export type ProfileInput = z.infer<typeof profileSchema>;
