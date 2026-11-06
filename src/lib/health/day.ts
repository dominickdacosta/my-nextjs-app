import type { UnitSystem } from "./units";

export type DayWaterEntry = {
  id: string;
  amountMl: number;
  loggedOn: string;
  loggedAt: string;
};

export type DayMeasurement = {
  id: string;
  loggedOn: string;
  loggedAt: string;
  weightKg: number | null;
};

export type DayCheckin = {
  id: string;
  loggedOn: string;
  loggedAt?: string;
  mood: number | null;
  energy: number | null;
  stress?: number | null;
  soreness?: number | null;
};

export type DayPayload = {
  date: string;
  profile: {
    displayName: string;
    unitSystem: UnitSystem;
    timezone: string;
    hideCalories: boolean;
  };
  goals: {
    caloriesKcal: number;
    proteinG: number;
    waterMl: number;
    steps: number;
    activeMinutes: number;
    sleepMinutes: number;
    workoutsPerWeek: number;
  } | null;
  water: { entries: DayWaterEntry[]; totalMl: number };
  measurements: DayMeasurement[];
  weight: DayMeasurement | null;
  checkin: DayCheckin | null;
  activity: { steps: number; activeMinutes: number; distanceM: number } | null;
  food: unknown[];
  workouts: unknown[];
  sleep: { durationMin: number | null } | null;
};

export type QuickLogInput =
  | { kind: "water"; loggedOn: string; amountMl: number }
  | { kind: "weight"; loggedOn: string; weightKg: number }
  | {
      kind: "checkin";
      loggedOn: string;
      mood?: number;
      energy?: number;
    };

export function updateDayOptimistically(
  day: DayPayload,
  input: QuickLogInput,
  id: string,
  loggedAt: string,
): DayPayload {
  if (input.kind === "water") {
    if (day.water.entries.some((entry) => entry.id === id)) return day;
    const entry: DayWaterEntry = {
      id,
      loggedOn: input.loggedOn,
      loggedAt,
      amountMl: input.amountMl,
    };
    return {
      ...day,
      water: {
        entries: [entry, ...day.water.entries],
        totalMl: day.water.totalMl + input.amountMl,
      },
    };
  }

  if (input.kind === "weight") {
    if (day.measurements.some((entry) => entry.id === id)) return day;
    const measurement: DayMeasurement = {
      id,
      loggedOn: input.loggedOn,
      loggedAt,
      weightKg: input.weightKg,
    };
    return {
      ...day,
      measurements: [measurement, ...day.measurements],
      weight: measurement,
    };
  }

  const checkin = day.checkin ?? {
    id,
    loggedOn: input.loggedOn,
    mood: null,
    energy: null,
  };
  return {
    ...day,
    checkin: {
      ...checkin,
      mood: input.mood ?? checkin.mood,
      energy: input.energy ?? checkin.energy,
    },
  };
}
