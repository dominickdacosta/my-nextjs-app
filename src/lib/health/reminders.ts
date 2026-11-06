import { formatInTimeZone } from "date-fns-tz";

export type ReminderSchedule = {
  timezone: string;
  time: string;
  daysOfWeek: number[];
};

export function isReminderDueAt(
  reminder: ReminderSchedule,
  instant: Date,
): boolean {
  const localTime = formatInTimeZone(instant, reminder.timezone, "HH:mm");
  if (localTime !== reminder.time) return false;
  if (!reminder.daysOfWeek.length) return true;

  const localDate = formatInTimeZone(instant, reminder.timezone, "yyyy-MM-dd");
  const dayOfWeek = new Date(`${localDate}T12:00:00.000Z`).getUTCDay();
  return reminder.daysOfWeek.includes(dayOfWeek);
}
