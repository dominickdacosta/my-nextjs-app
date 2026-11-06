import { z } from "zod";
import { isDateString } from "../health/dates";

const sleepEntryFields = z.object({
  loggedOn: z.string().refine(isDateString, "Enter a valid log date."),
  sleepDate: z.string().refine(isDateString, "Enter a valid sleep date."),
  bedAt: z.string().datetime().nullable().optional(),
  wakeAt: z.string().datetime().nullable().optional(),
  durationMin: z.number().int().min(1).max(1440).nullable().optional(),
  quality: z.number().int().min(1).max(5).nullable().optional(),
  awakenings: z.number().int().min(0).max(100).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

function hasSleepData(entry: z.infer<typeof sleepEntryFields>): boolean {
  return (
    (entry.durationMin !== undefined && entry.durationMin !== null) ||
    (entry.quality !== undefined && entry.quality !== null) ||
    (entry.bedAt !== undefined && entry.bedAt !== null) ||
    (entry.wakeAt !== undefined && entry.wakeAt !== null) ||
    Boolean(entry.notes)
  );
}

export const sleepEntrySchema = sleepEntryFields.refine(
  hasSleepData,
  "Enter a sleep duration, quality, or sleep time.",
);

export const sleepRestoreSchema = sleepEntryFields.extend({
  loggedAt: z.string().datetime().optional(),
}).refine(hasSleepData, "Enter a sleep duration, quality, or sleep time.");
