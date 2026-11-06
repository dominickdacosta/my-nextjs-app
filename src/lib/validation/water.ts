import { z } from "zod";
import { isDateString } from "@/lib/health/dates";

export const waterEntrySchema = z.object({
  loggedOn: z.string().refine(isDateString, "Enter a valid log date."),
  amountMl: z.number().int().min(1).max(20000),
});

export const waterRestoreSchema = waterEntrySchema.extend({
  loggedAt: z.string().datetime().optional(),
});
