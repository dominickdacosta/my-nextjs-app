"use client";

import { useState } from "react";
import useSWR from "swr";
import type { UnitSystem } from "@/lib/health/units";
import type { TrendDay } from "@/lib/health/trends";
import { formatVolume, formatWeight } from "@/lib/health/units";

type TrendPayload = {
  from: string;
  to: string;
  profile: {
    unitSystem: UnitSystem;
    hideCalories: boolean;
  };
  days: TrendDay[];
  streaks: { current: number; best: number; loggedDays: number };
};
type ChartMetric = "calories" | "water" | "steps" | "sleep" | "workouts";

const chartLabels: Record<ChartMetric, string> = {
  calories: "Calories",
  water: "Water",
  steps: "Steps",
  sleep: "Sleep",
  workouts: "Workouts",
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

  const calorieDays = data.days.filter((day) => day.caloriesKcal > 0);
  const waterDays = data.days.filter((day) => day.waterMl > 0);
  const stepDays = data.days.filter((day) => day.steps > 0);
  const sleepDays = data.days
    .map((day) => day.sleepMinutes)
    .filter((minutes): minutes is number => minutes !== null);
  const workouts = data.days.reduce((total, day) => total + day.workoutCount, 0);
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
  const averageMood = average(data.days.map((day) => day.mood));
  const visibleChartMetric =
    data.profile.hideCalories && chartMetric === "calories"
      ? "water"
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

      <section aria-label="Consistency" className="grid gap-4 sm:grid-cols-3">
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
          label="Workouts"
          value={`${workouts}`}
          detail={`Across ${range} days`}
        />
      </section>

      <section aria-label="Daily averages" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!data.profile.hideCalories ? (
          <SummaryCard
            label="Average calories"
            value={calorieDays.length ? `${Math.round(average(calorieDays.map((day) => day.caloriesKcal)) ?? 0)} kcal` : "—"}
            detail={`${calorieDays.length} days with food logs`}
          />
        ) : null}
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
        <SummaryCard
          label="Average sleep"
          value={averageSleep === null ? "—" : `${(averageSleep / 60).toFixed(1)} h`}
          detail={`${sleepDays.length} sleep logs`}
        />
        <SummaryCard
          label="Average mood"
          value={averageMood === null ? "—" : `${averageMood.toFixed(1)} / 5`}
          detail="On days with a mood check-in"
        />
        <SummaryCard
          label="Weight change"
          value={weightChange === null ? "—" : `${weightChange > 0 ? "+" : ""}${formatWeight(weightChange, data.profile.unitSystem)}`}
          detail={weights.length > 1 ? `${weights.length} logged measurements` : "Log at least two measurements"}
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
              <option value="water">Water</option>
              <option value="steps">Steps</option>
              <option value="sleep">Sleep</option>
              <option value="workouts">Workouts</option>
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
          <li className="rounded-xl bg-paper p-4">
            {workouts
              ? `You logged ${workouts} ${workouts === 1 ? "workout" : "workouts"} in the last ${range} days.`
              : "No workouts are in this range yet."}
          </li>
          <li className="rounded-xl bg-paper p-4">
            {averageSleep === null
              ? "Sleep trends will appear after you record a sleep entry."
              : `Your average logged sleep was ${(averageSleep / 60).toFixed(1)} hours.`}
          </li>
          <li className="rounded-xl bg-paper p-4">
            {averageMood === null
              ? "Mood patterns will appear after a few check-ins."
              : `Your average mood check-in was ${averageMood.toFixed(1)} out of 5.`}
          </li>
          <li className="rounded-xl bg-paper p-4">
            You logged water on {waterDays.length} of the last {range} days.
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
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
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
      case "water":
        return day.waterMl;
      case "steps":
        return day.steps;
      case "sleep":
        return day.sleepMinutes ?? 0;
      case "workouts":
        return day.workoutCount;
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
                : ""}
          </li>
        ))}
      </ul>
    </>
  );
}
