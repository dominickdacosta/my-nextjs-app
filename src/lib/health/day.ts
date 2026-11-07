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
  bodyFatPct?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  chestCm?: number | null;
  armCm?: number | null;
  thighCm?: number | null;
};

export type DayCheckin = {
  id: string;
  loggedOn: string;
  loggedAt?: string;
  energy: number | null;
  stress?: number | null;
  soreness?: number | null;
};

export type DayFoodEntry = {
  id: string;
  loggedOn: string;
  loggedAt: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  servings: number;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  nutritionSource: "estimated" | "verified" | "manual";
  notes: string | null;
};

export type DayWorkout = {
  id: string;
  loggedOn: string;
  loggedAt: string;
  type: "strength" | "cardio" | "walk" | "run" | "other";
  title: string | null;
  durationMin: number | null;
  distanceM: number | null;
  steps: number | null;
  caloriesBurned: number | null;
};

export type DayVital = {
  id: string;
  loggedOn: string;
  loggedAt: string;
  kind: string;
  valuePrimary: number;
  valueSecondary: number | null;
  unit: string;
  context: string | null;
  measuredAt: string | null;
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
    carbsG: number;
    fatG: number;
    fiberG: number;
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
  activity: {
    steps: number;
    activeMinutes: number;
    distanceM: number;
    source: string | null;
  } | null;
  vitals: DayVital[];
  food: DayFoodEntry[];
  workouts: DayWorkout[];
  sleep: {
    id: string;
    loggedOn: string;
    sleepDate: string;
    durationMin: number | null;
    quality: number | null;
    awakenings: number | null;
  } | null;
};

export type QuickLogInput =
  | { kind: "water"; loggedOn: string; amountMl: number }
  | { kind: "weight"; loggedOn: string; weightKg: number }
  | {
      kind: "checkin";
      loggedOn: string;
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
    energy: null,
  };
  return {
    ...day,
    checkin: {
      ...checkin,
      energy: input.energy ?? checkin.energy,
    },
  };
}
