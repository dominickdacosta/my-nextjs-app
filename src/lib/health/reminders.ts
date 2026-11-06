import { formatInTimeZone } from "date-fns-tz";

export type ReminderSchedule = {
  timezone: string;
  daysOfWeek: number[];
};

export function isReminderScheduledOn(
  reminder: ReminderSchedule,
  instant: Date,
): boolean {
  if (!reminder.daysOfWeek.length) return true;

  const localDate = formatInTimeZone(instant, reminder.timezone, "yyyy-MM-dd");
  const dayOfWeek = new Date(`${localDate}T12:00:00.000Z`).getUTCDay();
  return reminder.daysOfWeek.includes(dayOfWeek);
}
