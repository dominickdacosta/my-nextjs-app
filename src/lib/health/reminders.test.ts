import { describe, expect, it } from "vitest";
import { isReminderScheduledOn } from "./reminders";
import { pushSubscriptionSchema, reminderSchema } from "../validation/reminder";

describe("health reminders", () => {
  it("uses the profile timezone and local weekday", () => {
    expect(
      isReminderScheduledOn(
        { timezone: "America/Los_Angeles", daysOfWeek: [0] },
        new Date("2024-01-08T07:30:00.000Z"),
      ),
    ).toBe(true);
    expect(
      isReminderScheduledOn(
        { timezone: "America/Los_Angeles", daysOfWeek: [1] },
        new Date("2024-01-08T07:30:00.000Z"),
      ),
    ).toBe(false);
  });

  it("treats an empty weekday list as daily", () => {
    const reminder = {
      timezone: "Asia/Tokyo",
      daysOfWeek: [],
    };
    expect(isReminderScheduledOn(reminder, new Date("2024-05-01T00:15:00.000Z"))).toBe(true);
    expect(isReminderScheduledOn(reminder, new Date("2024-05-01T00:16:00.000Z"))).toBe(true);
  });

  it("defaults the legacy time field and validates HTTPS subscriptions", () => {
    expect(reminderSchema.safeParse({
      kind: "hydration",
      daysOfWeek: [],
    }).data).toMatchObject({ time: "09:00" });
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
