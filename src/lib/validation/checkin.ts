import { z } from "zod";
import { isDateString } from "@/lib/health/dates";

export const checkinSchema = z
  .object({
    loggedOn: z
      .string()
      .refine(isDateString, "Enter a valid log date.")
      .optional(),
    mood: z.number().int().min(1).max(5).optional(),
    energy: z.number().int().min(1).max(5).optional(),
    stress: z.number().int().min(1).max(5).optional(),
    soreness: z.number().int().min(1).max(5).optional(),
  })
  .refine(
    ({ mood, energy, stress, soreness }) =>
      [mood, energy, stress, soreness].some((value) => value !== undefined),
    "Choose at least one check-in value.",
  );
