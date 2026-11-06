"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calorieFloor,
  suggestTargets,
  type ActivityLevel,
  type GoalType,
  type Sex,
  type SuggestedTargets,
} from "@/lib/health/energy";
import {
  cmToInches,
  flOzToMl,
  inchesToCm,
  kgToLb,
  lbToKg,
  mlToFlOz,
} from "@/lib/health/units";
import { APP_NAME } from "@/lib/constants";

type FormState = {
  displayName: string;
  unitSystem: "metric" | "imperial";
  timezone: string;
  sex: Sex;
  birthDate: string;
  heightCm: string;
  currentWeightKg: string;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  targetWeightKg: string;
  weeklyRateKg: string;
};

const defaultTargets: SuggestedTargets = {
  caloriesKcal: 2000,
  proteinG: 100,
  carbsG: 250,
  fatG: 67,
  fiberG: 28,
  waterMl: 2000,
  steps: 8000,
  activeMinutes: 30,
  sleepMinutes: 480,
  workoutsPerWeek: 3,
};

const targetFields: Array<[keyof SuggestedTargets, string]> = [
  ["caloriesKcal", "Calories (kcal)"],
  ["proteinG", "Protein (g)"],
  ["carbsG", "Carbohydrates (g)"],
  ["fatG", "Fat (g)"],
  ["fiberG", "Fiber (g)"],
  ["waterMl", "Water (ml)"],
  ["steps", "Daily steps"],
  ["activeMinutes", "Active minutes"],
  ["sleepMinutes", "Sleep (minutes)"],
  ["workoutsPerWeek", "Workouts per week"],
];

const steps = ["Basics", "Body", "Goals", "Targets"];

function numberField(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function displayUnitValue(
  value: string,
  convert: (canonicalValue: number) => number,
): string {
  const parsed = numberField(value);
  return parsed === undefined ? "" : convert(parsed).toFixed(1);
}

export default function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    displayName: "",
    unitSystem: "metric",
    timezone: "",
    sex: "prefer_not",
    birthDate: "",
    heightCm: "",
    currentWeightKg: "",
    activityLevel: "moderate",
    goalType: "maintain",
    targetWeightKg: "",
    weeklyRateKg: "0",
  });
  const [unitValues, setUnitValues] = useState({
    height: "",
    weight: "",
    targetWeight: "",
    weeklyRate: "0",
  });
  const [targets, setTargets] = useState(defaultTargets);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      timezone:
        current.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    }));
  }, []);

  const profileForSuggestion = useMemo(
    () => ({
      sex: form.sex,
      birthDate: form.birthDate,
      heightCm: numberField(form.heightCm) ?? 0,
      weightKg: numberField(form.currentWeightKg) ?? 0,
      activityLevel: form.activityLevel,
      goalType: form.goalType,
      weeklyRateKg: numberField(form.weeklyRateKg) ?? 0,
    }),
    [form],
  );

  useEffect(() => {
    if (step !== 3) return;
    const suggested = suggestTargets(profileForSuggestion);
    if (suggested) setTargets(suggested);
  }, [profileForSuggestion, step]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeUnitSystem(unitSystem: FormState["unitSystem"]) {
    setUnitValues({
      height:
        unitSystem === "metric"
          ? form.heightCm
          : displayUnitValue(form.heightCm, cmToInches),
      weight:
        unitSystem === "metric"
          ? form.currentWeightKg
          : displayUnitValue(form.currentWeightKg, kgToLb),
      targetWeight:
        unitSystem === "metric"
          ? form.targetWeightKg
          : displayUnitValue(form.targetWeightKg, kgToLb),
      weeklyRate:
        unitSystem === "metric"
          ? form.weeklyRateKg
          : displayUnitValue(form.weeklyRateKg, kgToLb),
    });
    update("unitSystem", unitSystem);
  }

  async function saveOnboarding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const profileResponse = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          heightCm: numberField(form.heightCm),
          currentWeightKg: numberField(form.currentWeightKg),
          targetWeightKg: numberField(form.targetWeightKg) ?? null,
          weeklyRateKg: numberField(form.weeklyRateKg),
          hideCalories: false,
        }),
      });
      if (!profileResponse.ok) {
        const result = (await profileResponse.json()) as { error?: string };
        throw new Error(result.error ?? "Could not save your profile.");
      }

      const goalsResponse = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targets),
      });
      if (!goalsResponse.ok) {
        const result = (await goalsResponse.json()) as { error?: string };
        throw new Error(result.error ?? "Could not save your goals.");
      }
      router.replace("/");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save your profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="mt-8" onSubmit={saveOnboarding}>
      <nav aria-label="Onboarding progress" className="mb-8 grid grid-cols-4 gap-2">
        {steps.map((label, index) => (
          <span
            aria-current={index === step ? "step" : undefined}
            className={`rounded-full px-2 py-2 text-center text-xs ${
              index === step ? "bg-brand text-white" : "bg-card text-muted"
            }`}
            key={label}
          >
            {label}
          </span>
        ))}
      </nav>

      {step === 0 ? (
        <section className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Name
            <input
              autoComplete="name"
              className="min-h-11 rounded-xl border border-line bg-card px-3"
              onChange={(event) => update("displayName", event.target.value)}
              required
              value={form.displayName}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Unit system
            <select
              className="min-h-11 rounded-xl border border-line bg-card px-3"
              onChange={(event) =>
                changeUnitSystem(event.target.value as FormState["unitSystem"])
              }
              value={form.unitSystem}
            >
              <option value="metric">Metric</option>
              <option value="imperial">Imperial</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium sm:col-span-2">
            Timezone
            <input
              autoComplete="off"
              className="min-h-11 rounded-xl border border-line bg-card px-3"
              onChange={(event) => update("timezone", event.target.value)}
              placeholder="America/New_York"
              required
              value={form.timezone}
            />
          </label>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Sex for energy estimates
            <select
              className="min-h-11 rounded-xl border border-line bg-card px-3"
              onChange={(event) => update("sex", event.target.value as Sex)}
              value={form.sex}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Birth date
            <input
              className="min-h-11 rounded-xl border border-line bg-card px-3"
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => update("birthDate", event.target.value)}
              required
              type="date"
              value={form.birthDate}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Height ({form.unitSystem === "metric" ? "cm" : "in"})
            <input
              className="min-h-11 rounded-xl border border-line bg-card px-3"
              inputMode="decimal"
              min="1"
              onChange={(event) => {
                const value = event.target.value;
                setUnitValues((current) => ({ ...current, height: value }));
                update(
                  "heightCm",
                  value === ""
                    ? ""
                    : String(
                        form.unitSystem === "metric"
                          ? Number(value)
                          : inchesToCm(Number(value)),
                      ),
                );
              }}
              required
              step="0.1"
              type="number"
              value={unitValues.height}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Current weight ({form.unitSystem === "metric" ? "kg" : "lb"})
            <input
              className="min-h-11 rounded-xl border border-line bg-card px-3"
              inputMode="decimal"
              min="1"
              onChange={(event) => {
                const value = event.target.value;
                setUnitValues((current) => ({ ...current, weight: value }));
                update(
                  "currentWeightKg",
                  value === ""
                    ? ""
                    : String(
                        form.unitSystem === "metric"
                          ? Number(value)
                          : lbToKg(Number(value)),
                      ),
                );
              }}
              required
              step="0.1"
              type="number"
              value={unitValues.weight}
            />
          </label>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Activity level
            <select
              className="min-h-11 rounded-xl border border-line bg-card px-3"
              onChange={(event) =>
                update("activityLevel", event.target.value as ActivityLevel)
              }
              value={form.activityLevel}
            >
              <option value="sedentary">Sedentary</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="active">Active</option>
              <option value="very_active">Very active</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Goal
            <select
              className="min-h-11 rounded-xl border border-line bg-card px-3"
              onChange={(event) => update("goalType", event.target.value as GoalType)}
              value={form.goalType}
            >
              <option value="lose">Lose weight</option>
              <option value="maintain">Maintain</option>
              <option value="gain">Gain weight</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Target weight ({form.unitSystem === "metric" ? "kg" : "lb"}, optional)
            <input
              className="min-h-11 rounded-xl border border-line bg-card px-3"
              inputMode="decimal"
              min="1"
              onChange={(event) => {
                const value = event.target.value;
                setUnitValues((current) => ({
                  ...current,
                  targetWeight: value,
                }));
                update(
                  "targetWeightKg",
                  value === ""
                    ? ""
                    : String(
                        form.unitSystem === "metric"
                          ? Number(value)
                          : lbToKg(Number(value)),
                      ),
                );
              }}
              step="0.1"
              type="number"
              value={unitValues.targetWeight}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Weekly rate ({form.unitSystem === "metric" ? "kg" : "lb"})
            <input
              className="min-h-11 rounded-xl border border-line bg-card px-3"
              inputMode="decimal"
              max={form.unitSystem === "metric" ? "2" : "4.4"}
              min="0"
              onChange={(event) => {
                const value = event.target.value;
                setUnitValues((current) => ({
                  ...current,
                  weeklyRate: value,
                }));
                update(
                  "weeklyRateKg",
                  value === ""
                    ? ""
                    : String(
                        form.unitSystem === "metric"
                          ? Number(value)
                          : lbToKg(Number(value)),
                      ),
                );
              }}
              step="0.1"
              type="number"
              value={unitValues.weeklyRate}
            />
          </label>
        </section>
      ) : null}

      {step === 3 ? (
        <section>
          <p className="mb-5 text-sm text-muted">
            These starting points are estimates. Adjust any value to fit your
            needs.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {targetFields.map(([key, label]) => {
              const waterInImperial =
                key === "waterMl" && form.unitSystem === "imperial";
              return (
                <label className="grid gap-2 text-sm font-medium" key={key}>
                  {waterInImperial ? "Water (fl oz)" : label}
                  <input
                    className="min-h-11 rounded-xl border border-line bg-card px-3"
                    inputMode={waterInImperial ? "decimal" : "numeric"}
                    min="0"
                    onChange={(event) =>
                      setTargets((current) => ({
                        ...current,
                        [key]: waterInImperial
                          ? Math.round(flOzToMl(Number(event.target.value)))
                          : Number(event.target.value),
                      }))
                    }
                    required
                    step={waterInImperial ? "0.1" : "1"}
                    type="number"
                    value={
                      waterInImperial
                        ? mlToFlOz(targets.waterMl).toFixed(1)
                        : targets[key]
                    }
                  />
                </label>
              );
            })}
          </div>
          {targets.caloriesKcal < calorieFloor(form.sex) ? (
            <p className="mt-4 rounded-2xl border border-line bg-card p-4 text-sm text-muted" role="status">
              This calorie target is below a commonly used minimum for energy
              estimates. Consider discussing your needs with a qualified
              clinician before using it.
            </p>
          ) : null}
          <p className="mt-6 rounded-2xl border border-line bg-card p-4 text-sm text-muted">
            {APP_NAME} is for personal tracking and is not medical advice. These
            estimates are informational and are not a substitute for care from
            a qualified clinician.
          </p>
        </section>
      ) : null}

      {error ? (
        <p className="mt-5 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-8 flex justify-between gap-3">
        <button
          className="min-h-11 rounded-xl border border-line px-5"
          disabled={step === 0 || saving}
          onClick={() => setStep((current) => current - 1)}
          type="button"
        >
          Back
        </button>
        {step < 3 ? (
          <button
            className="min-h-11 rounded-xl bg-brand px-5 font-medium text-white"
            onClick={(event) => {
              if (event.currentTarget.form?.reportValidity()) {
                setStep((current) => current + 1);
              }
            }}
            type="button"
          >
            Continue
          </button>
        ) : (
          <button
            className="min-h-11 rounded-xl bg-brand px-5 font-medium text-white"
            disabled={saving}
            type="submit"
          >
            {saving ? "Saving..." : "Finish setup"}
          </button>
        )}
      </div>
    </form>
  );
}
