export type TrendDay = {
  date: string;
  caloriesKcal: number;
  proteinG: number;
  waterMl: number;
  weightKg: number | null;
  workoutCount: number;
  activeMinutes: number;
  sleepMinutes: number | null;
  steps: number;
  mood: number | null;
  energy: number | null;
  hasLog: boolean;
};

export type TrendRows = {
  dates: string[];
  food: Array<{
    loggedOn: string;
    servings: number;
    kcal: number;
    proteinG: number | null;
  }>;
  water: Array<{ loggedOn: string; amountMl: number }>;
  weights: Array<{ loggedOn: string; weightKg: number | null }>;
  workouts: Array<{ loggedOn: string; durationMin: number | null }>;
  sleep: Array<{ loggedOn: string; durationMin: number | null }>;
  activity: Array<{
    loggedOn: string;
    steps: number;
    activeMinutes: number;
  }>;
  checkins: Array<{
    loggedOn: string;
    mood: number | null;
    energy: number | null;
  }>;
  vitals: Array<{ loggedOn: string }>;
};

export function aggregateTrendDays(rows: TrendRows): TrendDay[] {
  const days = new Map<string, TrendDay>(
    rows.dates.map((date) => [
      date,
      {
        date,
        caloriesKcal: 0,
        proteinG: 0,
        waterMl: 0,
        weightKg: null,
        workoutCount: 0,
        activeMinutes: 0,
        sleepMinutes: null,
        steps: 0,
        mood: null,
        energy: null,
        hasLog: false,
      },
    ]),
  );

  for (const entry of rows.food) {
    const day = days.get(entry.loggedOn);
    if (!day) continue;
    day.caloriesKcal += entry.kcal * entry.servings;
    day.proteinG += (entry.proteinG ?? 0) * entry.servings;
    day.hasLog = true;
  }
  for (const entry of rows.water) {
    const day = days.get(entry.loggedOn);
    if (!day) continue;
    day.waterMl += entry.amountMl;
    day.hasLog = true;
  }
  for (const entry of rows.weights) {
    const day = days.get(entry.loggedOn);
    if (!day) continue;
    day.weightKg ??= entry.weightKg;
    day.hasLog = true;
  }
  for (const entry of rows.workouts) {
    const day = days.get(entry.loggedOn);
    if (!day) continue;
    day.workoutCount += 1;
    day.activeMinutes += entry.durationMin ?? 0;
    day.hasLog = true;
  }
  for (const entry of rows.sleep) {
    const day = days.get(entry.loggedOn);
    if (!day || entry.durationMin === null) continue;
    day.sleepMinutes = (day.sleepMinutes ?? 0) + entry.durationMin;
    day.hasLog = true;
  }
  for (const entry of rows.activity) {
    const day = days.get(entry.loggedOn);
    if (!day) continue;
    day.steps += entry.steps;
    day.activeMinutes += entry.activeMinutes;
    day.hasLog = true;
  }
  for (const entry of rows.checkins) {
    const day = days.get(entry.loggedOn);
    if (!day) continue;
    day.mood = entry.mood;
    day.energy = entry.energy;
    day.hasLog = true;
  }
  for (const entry of rows.vitals) {
    const day = days.get(entry.loggedOn);
    if (day) day.hasLog = true;
  }

  return rows.dates.map((date) => days.get(date)!);
}

export function countLogStreaks(
  days: TrendDay[],
  today: string,
): { current: number; best: number; loggedDays: number } {
  let best = 0;
  let run = 0;
  let loggedDays = 0;
  for (const day of days) {
    if (day.hasLog) {
      run += 1;
      loggedDays += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  let index = days.length - 1;
  if (days[index]?.date === today && !days[index].hasLog) index -= 1;
  let current = 0;
  for (; index >= 0 && days[index].hasLog; index -= 1) current += 1;
  return { current, best, loggedDays };
}
