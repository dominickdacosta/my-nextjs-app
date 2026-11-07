export type TrendDay = {
  date: string;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
  weightKg: number | null;
  waistCm: number | null;
  bodyFatPct: number | null;
  workoutCount: number;
  activeMinutes: number;
  runCount: number;
  runDistanceM: number;
  runDurationSeconds: number;
  avgRunPaceSecPerKm: number | null;
  sleepMinutes: number | null;
  steps: number;
  energy: number | null;
  vitalCount: number;
  hasFoodLog: boolean;
  hasLog: boolean;
};

export type TrendRows = {
  dates: string[];
  food: Array<{
    loggedOn: string;
    servings: number;
    kcal: number;
    proteinG: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    fiberG?: number | null;
  }>;
  water: Array<{ loggedOn: string; amountMl: number }>;
  weights: Array<{
    loggedOn: string;
    weightKg: number | null;
    waistCm?: number | null;
    bodyFatPct?: number | null;
  }>;
  workouts: Array<{
    loggedOn: string;
    durationMin: number | null;
    durationSeconds?: number | null;
    type?: string;
    distanceM?: number | null;
  }>;
  sleep: Array<{ loggedOn: string; durationMin: number | null }>;
  activity: Array<{
    loggedOn: string;
    steps: number;
    activeMinutes: number;
    source: string | null;
  }>;
  checkins: Array<{
    loggedOn: string;
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
        carbsG: 0,
        fatG: 0,
        fiberG: 0,
        waterMl: 0,
        weightKg: null,
        waistCm: null,
        bodyFatPct: null,
        workoutCount: 0,
        activeMinutes: 0,
        runCount: 0,
        runDistanceM: 0,
        runDurationSeconds: 0,
        avgRunPaceSecPerKm: null,
        sleepMinutes: null,
        steps: 0,
        energy: null,
        vitalCount: 0,
        hasFoodLog: false,
        hasLog: false,
      },
    ]),
  );

  for (const entry of rows.food) {
    const day = days.get(entry.loggedOn);
    if (!day) continue;
    day.caloriesKcal += entry.kcal * entry.servings;
    day.proteinG += (entry.proteinG ?? 0) * entry.servings;
    day.carbsG += (entry.carbsG ?? 0) * entry.servings;
    day.fatG += (entry.fatG ?? 0) * entry.servings;
    day.fiberG += (entry.fiberG ?? 0) * entry.servings;
    day.hasFoodLog = true;
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
    day.waistCm ??= entry.waistCm ?? null;
    day.bodyFatPct ??= entry.bodyFatPct ?? null;
    day.hasLog = true;
  }
  for (const entry of rows.workouts) {
    const day = days.get(entry.loggedOn);
    if (!day) continue;
    day.workoutCount += 1;
    day.activeMinutes += entry.durationMin ?? 0;
    if (entry.type === "run") {
      day.runCount += 1;
      day.runDistanceM += entry.distanceM ?? 0;
      day.runDurationSeconds +=
        entry.durationSeconds ??
        (entry.durationMin !== null ? entry.durationMin * 60 : 0);
    }
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
    if (entry.source === "health-connect") day.steps += entry.steps;
    day.activeMinutes += entry.activeMinutes;
    day.hasLog = true;
  }
  for (const entry of rows.checkins) {
    const day = days.get(entry.loggedOn);
    if (!day) continue;
    day.energy = entry.energy;
    day.hasLog = true;
  }
  for (const entry of rows.vitals) {
    const day = days.get(entry.loggedOn);
    if (day) {
      day.vitalCount += 1;
      day.hasLog = true;
    }
  }

  return rows.dates.map((date) => {
    const day = days.get(date)!;
    day.avgRunPaceSecPerKm =
      day.runDistanceM > 0
        ? Math.round(day.runDurationSeconds / (day.runDistanceM / 1000))
        : null;
    return day;
  });
}

export type StrengthSetRow = {
  exerciseId: string | null;
  exerciseName: string | null;
  loggedOn: string;
  weightKg: number | null;
  reps: number | null;
  isWarmup: boolean;
  completed: boolean;
};

export function summarizeStrengthProgress(
  rows: StrengthSetRow[],
): Array<{
  exerciseId: string;
  name: string;
  personalBestKg: number;
  latestBestKg: number;
  previousBestKg: number | null;
}> {
  const grouped = new Map<string, StrengthSetRow[]>();
  for (const row of rows) {
    if (
      !row.exerciseId ||
      !row.exerciseName ||
      row.weightKg === null ||
      row.isWarmup ||
      !row.completed
    ) {
      continue;
    }
    grouped.set(row.exerciseId, [
      ...(grouped.get(row.exerciseId) ?? []),
      row,
    ]);
  }
  return Array.from(grouped, ([exerciseId, exerciseRows]) => {
    const sessions = new Map<string, number>();
    for (const row of exerciseRows) {
      sessions.set(
        row.loggedOn,
        Math.max(sessions.get(row.loggedOn) ?? 0, row.weightKg ?? 0),
      );
    }
    const ordered = [...sessions.entries()].sort(([left], [right]) =>
      right.localeCompare(left),
    );
    return {
      exerciseId,
      name: exerciseRows[0].exerciseName ?? "Exercise",
      personalBestKg: Math.max(...ordered.map(([, weight]) => weight)),
      latestBestKg: ordered[0][1],
      previousBestKg: ordered[1]?.[1] ?? null,
    };
  }).sort((left, right) => left.name.localeCompare(right.name));
}

export function compareLoggedTotals(
  current: TrendDay[],
  previous: TrendDay[],
): {
  currentProteinAverage: number | null;
  previousProteinAverage: number | null;
  currentRunDistanceM: number;
  previousRunDistanceM: number;
} {
  const averageProtein = (days: TrendDay[]) => {
    const logged = days.filter((day) => day.hasFoodLog);
    return logged.length
      ? logged.reduce((total, day) => total + day.proteinG, 0) / logged.length
      : null;
  };
  return {
    currentProteinAverage: averageProtein(current),
    previousProteinAverage: averageProtein(previous),
    currentRunDistanceM: current.reduce((total, day) => total + day.runDistanceM, 0),
    previousRunDistanceM: previous.reduce((total, day) => total + day.runDistanceM, 0),
  };
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
