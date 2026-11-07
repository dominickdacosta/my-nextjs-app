"use client";

import { useState } from "react";
import useSWR from "swr";
import type { UnitSystem } from "@/lib/health/units";
import {
  compareLoggedTotals,
  type TrendDay,
} from "@/lib/health/trends";
import {
  formatDistance,
  formatVolume,
  formatWeight,
} from "@/lib/health/units";

type TrendPayload = {
  from: string;
  to: string;
  profile: {
    unitSystem: UnitSystem;
    hideCalories: boolean;
  };
  goals: {
    caloriesKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
  } | null;
  days: TrendDay[];
  comparisonDays: TrendDay[];
  comparisonFrom: string;
  comparisonTo: string;
  streaks: { current: number; best: number; loggedDays: number };
  strengthProgress: Array<{
    exerciseId: string;
    name: string;
    personalBestKg: number;
    latestBestKg: number;
    previousBestKg: number | null;
  }>;
  latestVitals: Array<{
    kind: string;
    valuePrimary: number;
    valueSecondary: number | null;
    unit: string;
    loggedOn: string;
  }>;
  runningRecords: {
    longestDistanceM: number | null;
    fastestPaceSecPerKm: number | null;
    runCount: number;
  };
};
type ChartMetric =
  | "calories"
  | "protein"
  | "fiber"
  | "water"
  | "steps"
  | "sleep"
  | "workouts"
  | "running";

const chartLabels: Record<ChartMetric, string> = {
  calories: "Calories",
  protein: "Protein",
  fiber: "Fiber",
  water: "Water",
  steps: "Steps",
  sleep: "Sleep",
  workouts: "Workouts",
  running: "Running distance",
};

async function fetchTrends(url: string): Promise<TrendPayload> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load your health trends.");
  return (await response.json()) as TrendPayload;
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length
    ? present.reduce((sum, value) => sum + value, 0) / present.length
    : null;
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function formatPace(secondsPerKm: number, unitSystem: UnitSystem): string {
  const secondsPerUnit =
    unitSystem === "metric" ? secondsPerKm : secondsPerKm * 1.609344;
  const minutes = Math.floor(secondsPerUnit / 60);
  const seconds = Math.round(secondsPerUnit % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")} / ${unitSystem === "metric" ? "km" : "mi"}`;
}

export default function TrendsPage() {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("calories");
  const { data, error, isLoading } = useSWR<TrendPayload>(
    `/api/trends?days=${range}`,
    fetchTrends,
  );

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-36 pt-8 sm:px-8 lg:pb-12">
        <p aria-live="polite" className="rounded-2xl bg-card p-5 text-muted" role="status">
          {error ? "Your trends could not be loaded." : "Loading your trends..."}
        </p>
        {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error.message}</p> : null}
      </main>
    );
  }

  const foodDays = data.days.filter((day) => day.hasFoodLog);
  const waterDays = data.days.filter((day) => day.waterMl > 0);
  const stepDays = data.days.filter((day) => day.steps > 0);
  const sleepDays = data.days
    .map((day) => day.sleepMinutes)
    .filter((minutes): minutes is number => minutes !== null);
  const workouts = data.days.reduce((total, day) => total + day.workoutCount, 0);
  const activeMinutes = data.days.reduce((total, day) => total + day.activeMinutes, 0);
  const weights = data.days.filter((day) => day.weightKg !== null);
  const firstWeight = weights[0]?.weightKg;
  const lastWeight = weights[weights.length - 1]?.weightKg;
  const weightChange =
    weights.length > 1 && firstWeight !== null && firstWeight !== undefined &&
    lastWeight !== null && lastWeight !== undefined
      ? lastWeight - firstWeight
      : null;
  const averageSleep = average(sleepDays);
  const averageWater = average(data.days.map((day) => day.waterMl));
  const averageSteps = average(data.days.map((day) => day.steps));
  const averageCalories = average(foodDays.map((day) => day.caloriesKcal));
  const averageProtein = average(foodDays.map((day) => day.proteinG));
  const averageCarbs = average(foodDays.map((day) => day.carbsG));
  const averageFat = average(foodDays.map((day) => day.fatG));
  const averageFiber = average(foodDays.map((day) => day.fiberG));
  const proteinGoal = data.goals?.proteinG ?? null;
  const proteinGoalDays = proteinGoal !== null
    ? foodDays.filter((day) => day.proteinG >= proteinGoal).length
    : null;
  const comparison = compareLoggedTotals(data.days, data.comparisonDays);
  const runDistanceM = comparison.currentRunDistanceM;
  const runSeconds = data.days.reduce((total, day) => total + day.runDurationSeconds, 0);
  const averageRunPace =
    runDistanceM > 0 ? Math.round(runSeconds / (runDistanceM / 1000)) : null;
  const latestBody = [...data.days].reverse().find(
    (day) => day.weightKg !== null || day.waistCm !== null || day.bodyFatPct !== null,
  );
  const weightLabel =
    weightChange === null
      ? "—"
      : `${weightChange > 0 ? "+" : ""}${formatWeight(weightChange, data.profile.unitSystem)}`;
  const rangeLabel = range === 7 ? "week" : `${range}-day period`;
  const observations: string[] = [];
  if (
    averageProtein !== null &&
    data.goals &&
    averageProtein < data.goals.proteinG
  ) {
    observations.push(
      `Average logged protein was ${Math.round(averageProtein)} g per food-logged day, below your ${data.goals.proteinG} g target.`,
    );
  } else if (averageProtein !== null && data.goals) {
    observations.push("Your average logged protein met or exceeded your daily target in this period.");
  }
  if (runDistanceM > 0 || comparison.previousRunDistanceM > 0) {
    if (runDistanceM > comparison.previousRunDistanceM) {
      observations.push("Your logged running distance increased compared with the previous period.");
    } else if (runDistanceM < comparison.previousRunDistanceM) {
      observations.push("Your logged running distance was lower than the previous period.");
    } else {
      observations.push("Your logged running distance was similar to the previous period.");
    }
  }
  if (weightChange !== null && Math.abs(weightChange) <= 1.5) {
    observations.push("Your logged weight remained relatively stable during this range.");
  }
  if (workouts > 0) {
    observations.push(
      `You logged ${workouts} ${workouts === 1 ? "workout" : "workouts"} and ${activeMinutes} active minutes in this ${rangeLabel}.`,
    );
  }
  if (!observations.length) {
    observations.push("More observations will appear as you add nutrition, fitness, or health logs.");
  }
  const visibleChartMetric =
    data.profile.hideCalories && chartMetric === "calories"
      ? "protein"
      : chartMetric;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-36 pt-7 sm:px-8 sm:pt-10 lg:pb-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-medium text-brand">Patterns, not pressure</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Trends</h1>
          <p className="mt-2 text-sm text-muted">
            A personal look at your logs. These summaries are not medical advice.
          </p>
        </div>
        <label className="grid gap-1 text-sm font-medium">
          Time range
          <select
            className="min-h-11 rounded-xl border border-line bg-card px-3"
            onChange={(event) => setRange(Number(event.target.value) as 7 | 30 | 90)}
            value={range}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </label>
      </header>

      <section aria-label="Consistency and comparisons" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Current logging streak"
          value={`${data.streaks.current} ${data.streaks.current === 1 ? "day" : "days"}`}
          detail="A log in any health category"
        />
        <SummaryCard
          label="Best streak in range"
          value={`${data.streaks.best} ${data.streaks.best === 1 ? "day" : "days"}`}
          detail={`${data.streaks.loggedDays} logged days in this range`}
        />
        <SummaryCard
          label="Workout frequency"
          value={`${(workouts / range * 7).toFixed(1)} / week`}
          detail={`${workouts} sessions in this ${rangeLabel}`}
        />
        <SummaryCard
          label="Protein vs previous period"
          value={
            comparison.currentProteinAverage !== null &&
            comparison.previousProteinAverage !== null
              ? `${comparison.currentProteinAverage - comparison.previousProteinAverage > 0 ? "+" : ""}${Math.round(comparison.currentProteinAverage - comparison.previousProteinAverage)} g`
              : "—"
          }
          detail={`Average per food-logged day · ${shortDate(data.comparisonFrom)}–${shortDate(data.comparisonTo)}`}
        />
      </section>

      <section aria-labelledby="nutrition-insights-title" className="mt-5 rounded-3xl border border-line bg-card p-5 sm:p-7">
        <h2 className="text-xl font-semibold" id="nutrition-insights-title">Nutrition</h2>
        <p className="mt-1 text-sm text-muted">
          Averages use days with food logs ({foodDays.length} of {range} days).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!data.profile.hideCalories ? (
          <SummaryCard
            label="Average calories"
            value={averageCalories === null ? "—" : `${Math.round(averageCalories)} kcal`}
            detail={data.goals ? `Daily target ${data.goals.caloriesKcal} kcal` : "Per food-logged day"}
          />
        ) : null}
        <SummaryCard
          label="Average protein"
          value={averageProtein === null ? "—" : `${Math.round(averageProtein)} g`}
          detail={
            data.goals && proteinGoalDays !== null
              ? `Target met on ${proteinGoalDays} of ${foodDays.length} logged days · goal ${data.goals.proteinG} g`
              : "Per food-logged day"
          }
          emphasis
        />
        <SummaryCard
          label="Average carbohydrates"
          value={averageCarbs === null ? "—" : `${Math.round(averageCarbs)} g`}
          detail={averageFat === null ? "Per food-logged day" : `Average fat ${Math.round(averageFat)} g`}
        />
        <SummaryCard
          label="Average fibre"
          value={averageFiber === null ? "—" : `${Math.round(averageFiber)} g`}
          detail={data.goals ? `Daily target ${data.goals.fiberG} g` : "Per food-logged day"}
        />
        </div>
      </section>

      <section aria-labelledby="fitness-insights-title" className="mt-5 rounded-3xl border border-line bg-card p-5 sm:p-7">
        <h2 className="text-xl font-semibold" id="fitness-insights-title">Fitness</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Workouts"
            value={`${workouts}`}
            detail={`${(workouts / range * 7).toFixed(1)} per week · ${range} days`}
          />
          <SummaryCard
            label="Active minutes"
            value={`${activeMinutes}`}
            detail={`Logged in this ${rangeLabel}`}
          />
          <SummaryCard
            label="Running distance"
            value={runDistanceM ? formatDistance(runDistanceM, data.profile.unitSystem) : "—"}
            detail={averageRunPace
              ? `Average pace ${formatPace(averageRunPace, data.profile.unitSystem)}`
              : `${data.days.reduce((total, day) => total + day.runCount, 0)} runs`}
          />
          <SummaryCard
            label="Running records"
            value={data.runningRecords.longestDistanceM
              ? formatDistance(data.runningRecords.longestDistanceM, data.profile.unitSystem)
              : "—"}
            detail={data.runningRecords.fastestPaceSecPerKm
              ? `Longest run · fastest pace ${formatPace(data.runningRecords.fastestPaceSecPerKm, data.profile.unitSystem)}`
              : `${data.runningRecords.runCount} recorded runs`}
          />
        </div>
        {data.strengthProgress.length ? (
          <div className="mt-5">
            <h3 className="font-semibold">Strength progression</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {data.strengthProgress.slice(0, 6).map((exercise) => (
                <li className="rounded-xl bg-paper p-3 text-sm" key={exercise.exerciseId}>
                  <p className="font-medium">{exercise.name}</p>
                  <p className="mt-1 text-muted">
                    Recent best {formatWeight(exercise.latestBestKg, data.profile.unitSystem)}
                    {exercise.previousBestKg !== null
                      ? ` · Previous ${formatWeight(exercise.previousBestKg, data.profile.unitSystem)}`
                      : ""}
                    {` · Period best ${formatWeight(exercise.personalBestKg, data.profile.unitSystem)}`}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-label="Health and body measurements" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Weight change"
          value={weightLabel}
          detail={weights.length > 1 ? `${weights.length} logged measurements` : "Log at least two measurements"}
        />
        <SummaryCard
          label="Waist / body fat"
          value={latestBody?.waistCm !== null && latestBody?.waistCm !== undefined
            ? `${latestBody.waistCm.toFixed(1)} cm`
            : "—"}
          detail={latestBody?.bodyFatPct !== null && latestBody?.bodyFatPct !== undefined
            ? `Body fat ${latestBody.bodyFatPct.toFixed(1)}%`
            : "Latest logged measurements"}
        />
        <SummaryCard
          label="Average sleep"
          value={averageSleep === null ? "—" : `${(averageSleep / 60).toFixed(1)} h`}
          detail={`${sleepDays.length} sleep logs`}
        />
        <SummaryCard
          label="Water and steps"
          value={averageWater === null ? "—" : formatVolume(averageWater, data.profile.unitSystem)}
          detail={averageSteps === null ? "No step data" : `${Math.round(averageSteps).toLocaleString()} average steps`}
        />
      </section>
      {data.latestVitals.length ? (
        <section aria-label="Recent vital measurements" className="mt-5 rounded-3xl border border-line bg-card p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Recent vital measurements</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.latestVitals.map((vital) => (
              <li className="rounded-xl bg-paper p-4" key={vital.kind}>
                <p className="text-sm text-muted">{vital.kind}</p>
                <p className="mt-1 font-semibold">
                  {vital.valuePrimary}
                  {vital.valueSecondary !== null ? ` / ${vital.valueSecondary}` : ""}
                  {" "}{vital.unit}
                </p>
                <p className="mt-1 text-xs text-muted">{shortDate(vital.loggedOn)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Daily averages" className="mt-4 grid gap-4 sm:grid-cols-2">
        <SummaryCard
          label="Average water"
          value={averageWater === null ? "—" : formatVolume(averageWater, data.profile.unitSystem)}
          detail={`${waterDays.length} days with water logs`}
        />
        <SummaryCard
          label="Average steps"
          value={averageSteps === null ? "—" : Math.round(averageSteps).toLocaleString()}
          detail={`${stepDays.length} days with step logs`}
        />
      </section>

      <section className="mt-5 rounded-3xl border border-line bg-card p-5 sm:p-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{shortDate(data.from)} – {shortDate(data.to)}</p>
            <h2 className="mt-1 text-xl font-semibold">{chartLabels[visibleChartMetric]} over time</h2>
          </div>
          <label className="grid gap-1 text-sm font-medium">
            Metric
            <select
              className="min-h-11 rounded-xl border border-line bg-paper px-3"
              onChange={(event) => setChartMetric(event.target.value as ChartMetric)}
              value={visibleChartMetric}
            >
              {!data.profile.hideCalories ? <option value="calories">Calories</option> : null}
              <option value="protein">Protein</option>
              <option value="fiber">Fibre</option>
              <option value="water">Water</option>
              <option value="steps">Steps</option>
              <option value="sleep">Sleep</option>
              <option value="workouts">Workouts</option>
              <option value="running">Running distance</option>
            </select>
          </label>
        </header>
        <TrendChart
          days={data.days}
          metric={visibleChartMetric}
          unitSystem={data.profile.unitSystem}
        />
      </section>

      <section className="mt-5 rounded-3xl border border-line bg-card p-5 sm:p-7">
        <h2 className="text-xl font-semibold">A few observations</h2>
        <ul className="mt-3 grid gap-3 text-sm leading-6 text-muted sm:grid-cols-2">
          {observations.map((observation) => (
            <li className="rounded-xl bg-paper p-4" key={observation}>{observation}</li>
          ))}
          {averageSleep !== null ? (
            <li className="rounded-xl bg-paper p-4">
              Your average logged sleep was {(averageSleep / 60).toFixed(1)} hours.
            </li>
          ) : null}
          <li className="rounded-xl bg-paper p-4">
            You logged water on {waterDays.length} of the {range} days in this range.
          </li>
        </ul>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  emphasis = false,
}: {
  label: string;
  value: string;
  detail: string;
  emphasis?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-line bg-card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${emphasis ? "text-brand" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </article>
  );
}

function TrendChart({
  days,
  metric,
  unitSystem,
}: {
  days: TrendDay[];
  metric: ChartMetric;
  unitSystem: UnitSystem;
}) {
  const values = days.map((day) => {
    switch (metric) {
      case "calories":
        return day.caloriesKcal;
      case "protein":
        return day.proteinG;
      case "fiber":
        return day.fiberG;
      case "water":
        return day.waterMl;
      case "steps":
        return day.steps;
      case "sleep":
        return day.sleepMinutes ?? 0;
      case "workouts":
        return day.workoutCount;
      case "running":
        return day.runDistanceM / (unitSystem === "metric" ? 1000 : 1609.344);
    }
  });
  const max = Math.max(1, ...values);
  return (
    <>
      <div
        aria-hidden="true"
        className="mt-6 overflow-x-auto pb-2"
      >
        <div className="flex min-w-full items-end gap-2" style={{ minWidth: `${Math.max(days.length * 38, 480)}px` }}>
          {days.map((day, index) => {
            const value = values[index];
            const height = value ? Math.max((value / max) * 100, 4) : 0;
            const formatted =
              metric === "water"
                ? formatVolume(value, unitSystem)
                : metric === "sleep"
                  ? `${(value / 60).toFixed(1)} h`
                  : metric === "running"
                    ? `${value.toFixed(1)} ${unitSystem === "metric" ? "km" : "mi"}`
                    : metric === "protein" || metric === "fiber"
                      ? `${Math.round(value)} g`
                  : value.toLocaleString();
            return (
              <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={day.date} title={`${day.date}: ${formatted}`}>
                <span className="text-[10px] text-muted">{value ? formatted : "—"}</span>
                <div className="flex h-40 w-full items-end rounded-t-lg bg-paper">
                  <div
                    className="w-full rounded-t-lg bg-brand"
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted">
                  {new Date(`${day.date}T12:00:00.000Z`).getUTCDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <ul className="sr-only" aria-label={`${chartLabels[metric]} daily values`}>
        {days.map((day, index) => (
          <li key={day.date}>
            {day.date}: {values[index]}
            {metric === "water"
              ? ` (${formatVolume(values[index], unitSystem)})`
              : metric === "sleep"
                ? " minutes"
                : metric === "running"
                  ? ` (${unitSystem === "metric" ? "km" : "mi"})`
                : ""}
          </li>
        ))}
      </ul>
    </>
  );
}
