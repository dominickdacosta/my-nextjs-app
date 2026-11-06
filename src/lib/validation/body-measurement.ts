import { z } from "zod";
import { isDateString } from "@/lib/health/dates";

export const bodyMeasurementSchema = z.object({
  loggedOn: z.string().refine(isDateString, "Enter a valid log date."),
  weightKg: z.number().positive().max(700),
});

export const bodyMeasurementRestoreSchema = bodyMeasurementSchema.extend({
  loggedAt: z.string().datetime().optional(),
});
