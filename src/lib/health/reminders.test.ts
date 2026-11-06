import { describe, expect, it } from "vitest";
import { isReminderDueAt } from "./reminders";
import { pushSubscriptionSchema, reminderSchema } from "../validation/reminder";

describe("health reminders", () => {
  it("uses the profile timezone and local weekday", () => {
    expect(
      isReminderDueAt(
        { timezone: "America/Los_Angeles", time: "23:30", daysOfWeek: [0] },
        new Date("2024-01-08T07:30:00.000Z"),
      ),
    ).toBe(true);
    expect(
      isReminderDueAt(
        { timezone: "America/Los_Angeles", time: "23:30", daysOfWeek: [1] },
        new Date("2024-01-08T07:30:00.000Z"),
      ),
    ).toBe(false);
  });

  it("treats an empty weekday list as daily and checks the exact minute", () => {
    const reminder = {
      timezone: "Asia/Tokyo",
      time: "09:15",
      daysOfWeek: [],
    };
    expect(isReminderDueAt(reminder, new Date("2024-05-01T00:15:00.000Z"))).toBe(true);
    expect(isReminderDueAt(reminder, new Date("2024-05-01T00:16:00.000Z"))).toBe(false);
  });

  it("validates schedule and HTTPS push subscription input", () => {
    expect(reminderSchema.safeParse({
      kind: "hydration",
      time: "24:00",
      daysOfWeek: [],
    }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({
      endpoint: "https://push.example.test/device",
      keys: { p256dh: "key", auth: "auth" },
    }).success).toBe(true);
    expect(pushSubscriptionSchema.safeParse({
      endpoint: "http://push.example.test/device",
      keys: { p256dh: "key", auth: "auth" },
    }).success).toBe(false);
  });
});
