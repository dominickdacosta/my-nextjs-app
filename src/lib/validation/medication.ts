import { z } from "zod";
import { isDateString } from "../health/dates";

const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

export const medicationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  dose: z.string().trim().max(120).nullable().optional(),
  schedule: z.string().trim().min(1).max(160),
  times: z.array(timeSchema).max(12).default([]),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  active: z.boolean().default(true),
});

export const medicationLogSchema = z.object({
  medicationId: z.string().uuid(),
  loggedOn: z.string().refine(isDateString, "Enter a valid log date."),
  scheduledFor: z.string().datetime(),
  status: z.enum(["taken", "skipped"]),
});

export const medicationLogRestoreSchema = medicationLogSchema.extend({
  loggedAt: z.string().datetime().optional(),
});
