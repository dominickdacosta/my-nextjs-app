import { z } from "zod";
import { isDateString } from "../health/dates";

const bodyMeasurementFields = z.object({
  loggedOn: z.string().refine(isDateString, "Enter a valid log date."),
  weightKg: z.number().positive().max(700).nullable().optional(),
  bodyFatPct: z.number().min(0).max(100).nullable().optional(),
  waistCm: z.number().positive().max(500).nullable().optional(),
  hipCm: z.number().positive().max(500).nullable().optional(),
  chestCm: z.number().positive().max(500).nullable().optional(),
  armCm: z.number().positive().max(200).nullable().optional(),
  thighCm: z.number().positive().max(300).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

function hasMeasurement(
  value: z.infer<typeof bodyMeasurementFields>,
): boolean {
  return [
    value.weightKg,
    value.bodyFatPct,
    value.waistCm,
    value.hipCm,
    value.chestCm,
    value.armCm,
    value.thighCm,
  ].some((measurement) => measurement !== undefined && measurement !== null);
}

export const bodyMeasurementSchema = bodyMeasurementFields.refine(
  hasMeasurement,
  "Enter at least one body measurement.",
);

export const bodyMeasurementRestoreSchema = bodyMeasurementFields.extend({
  loggedAt: z.string().datetime().optional(),
}).refine(
  hasMeasurement,
  "Enter at least one body measurement.",
);
