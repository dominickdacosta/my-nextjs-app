import { isDateString } from "./dates";

export type Sex = "female" | "male" | "other" | "prefer_not";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type GoalType = "lose" | "maintain" | "gain";

export type EnergyProfile = {
  sex: Sex;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  weeklyRateKg: number;
};

export type SuggestedTargets = {
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
};

const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function ageOnDate(birthDate: string, onDate: Date): number {
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  if (
    Number.isNaN(birth.getTime()) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
    birth.toISOString().slice(0, 10) !== birthDate
  ) {
    throw new RangeError("Birth date must be a valid YYYY-MM-DD date.");
  }

  let age = onDate.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayHasPassed =
    onDate.getUTCMonth() > birth.getUTCMonth() ||
    (onDate.getUTCMonth() === birth.getUTCMonth() &&
      onDate.getUTCDate() >= birth.getUTCDate());
  if (!birthdayHasPassed) age -= 1;
  return age;
}

export function calculateBmr(input: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
}): number {
  const { sex, age, heightCm, weightKg } = input;
  if (
    !Number.isFinite(age) ||
    !Number.isFinite(heightCm) ||
    !Number.isFinite(weightKg) ||
    age < 0 ||
    heightCm <= 0 ||
    weightKg <= 0
  ) {
    throw new RangeError("Age, height, and weight must be valid positive values.");
  }
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  return base - 78;
}

export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  if (!Number.isFinite(bmr) || bmr <= 0) {
    throw new RangeError("BMR must be a positive number.");
  }
  return bmr * activityMultipliers[activityLevel];
}

export function calorieFloor(sex: Sex): number {
  if (sex === "female") return 1200;
  if (sex === "male") return 1500;
  return 1350;
}

export function isBelowCalorieFloor(caloriesKcal: number, sex: Sex): boolean {
  return caloriesKcal < calorieFloor(sex);
}

export function estimateCaloriesFromSteps(steps: number): number {
  if (!Number.isSafeInteger(steps) || steps < 0) {
    throw new RangeError("Steps must be a non-negative whole number.");
  }
  // This general estimate varies with body size, stride, and walking pace.
  return Math.round(steps * 0.04);
}

export function defaultMacros(
  caloriesKcal: number,
  weightKg: number,
): Pick<SuggestedTargets, "proteinG" | "carbsG" | "fatG" | "fiberG"> {
  const proteinG = Math.round(weightKg * 1.6);
  const fatG = Math.round((caloriesKcal * 0.275) / 9);
  const carbsG = Math.max(
    0,
    Math.round((caloriesKcal - proteinG * 4 - fatG * 9) / 4),
  );
  return {
    proteinG,
    carbsG,
    fatG,
    fiberG: Math.round((caloriesKcal / 1000) * 14),
  };
}

function isEnergyProfile(profile: Partial<EnergyProfile>): profile is EnergyProfile {
  return (
    ["female", "male", "other", "prefer_not"].includes(profile.sex ?? "") &&
    isDateString(profile.birthDate ?? "") &&
    Number.isFinite(profile.heightCm) &&
    Number(profile.heightCm) > 0 &&
    Number.isFinite(profile.weightKg) &&
    Number(profile.weightKg) > 0 &&
    Object.hasOwn(activityMultipliers, profile.activityLevel ?? "") &&
    ["lose", "maintain", "gain"].includes(profile.goalType ?? "") &&
    Number.isFinite(profile.weeklyRateKg) &&
    Number(profile.weeklyRateKg) >= 0
  );
}

export function suggestTargets(
  profile: Partial<EnergyProfile>,
  onDate = new Date(),
): SuggestedTargets | null {
  if (!isEnergyProfile(profile)) return null;
  const age = ageOnDate(profile.birthDate, onDate);
  const bmr = calculateBmr({
    sex: profile.sex,
    age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
  });
  const tdee = calculateTdee(bmr, profile.activityLevel);
  const weeklyAdjustment =
    (Math.abs(profile.weeklyRateKg) * 7700) / 7;
  const adjustedCalories =
    profile.goalType === "lose"
      ? tdee - weeklyAdjustment
      : profile.goalType === "gain"
        ? tdee + weeklyAdjustment
        : tdee;
  const caloriesKcal = Math.max(
    calorieFloor(profile.sex),
    Math.round(adjustedCalories),
  );

  return {
    caloriesKcal,
    ...defaultMacros(caloriesKcal, profile.weightKg),
    waterMl: Math.round(profile.weightKg * 35),
    steps: 8000,
    activeMinutes: 30,
    sleepMinutes: 480,
    workoutsPerWeek: 3,
  };
}
