import { formatInTimeZone } from "date-fns-tz";

export function todayFor(timezone: string, now = new Date()): string {
  return formatInTimeZone(now, timezone, "yyyy-MM-dd");
}

export function isDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function addDays(date: string, amount: number): string {
  if (!isDateString(date) || !Number.isInteger(amount)) {
    throw new RangeError("Date and day offset must be valid.");
  }
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + amount);
  return result.toISOString().slice(0, 10);
}

export function weekStart(date: string): string {
  if (!isDateString(date)) throw new RangeError("Date must be a valid YYYY-MM-DD date.");
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

export function dateRange(from: string, to: string): string[] {
  if (!isDateString(from) || !isDateString(to) || from > to) {
    throw new RangeError("Date range must be valid and ordered.");
  }
  const result: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    result.push(date);
  }
  return result;
}
