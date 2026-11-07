import { z } from "zod";

const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

export const reminderSchema = z.object({
  kind: z.enum(["hydration", "wellbeing"]),
  time: timeSchema.default("09:00"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).default([]),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).refine(
    (value) => new URL(value).protocol === "https:",
    "Push endpoints must use HTTPS.",
  ),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
});

export const pushSubscriptionDeleteSchema = z.object({
  endpoint: z.string().url().max(2048),
});
