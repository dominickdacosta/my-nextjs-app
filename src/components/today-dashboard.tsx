"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { useAppContext } from "@/components/app-shell";
import type { DayPayload, DayWaterEntry } from "@/lib/health/day";
import { addDays, todayFor } from "@/lib/health/dates";
import { flOzToMl, formatVolume, formatWeight } from "@/lib/health/units";

const meals = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
const moodOptions = [
  { value: 1, icon: "😞", label: "Very low" },
  { value: 2, icon: "🙁", label: "A little low" },
  { value: 3, icon: "😐", label: "Okay" },
  { value: 4, icon: "🙂", label: "Good" },
  { value: 5, icon: "😄", label: "Great" },
];
const energyOptions = [
  { value: 1, icon: "🪫", label: "Very low" },
  { value: 2, icon: "😴", label: "Low" },
  { value: 3, icon: "😶", label: "Okay" },
  { value: 4, icon: "⚡", label: "Good" },
  { value: 5, icon: "✨", label: "High" },
];

async function fetchDay(url: string): Promise<DayPayload> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load today's summary.");
  return (await response.json()) as DayPayload;
}

export default function TodayDashboard() {
  const { selectedDate, setSelectedDate, submitLog, openQuickLog } = useAppContext();
  const dateQuery = selectedDate
    ? `?date=${encodeURIComponent(selectedDate)}`
    : "";
  const { data, error, isLoading, mutate } = useSWR<DayPayload>(
    `/api/day${dateQuery}`,
    fetchDay,
  );
  const [customWaterOpen, setCustomWaterOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [deletedWaterEntry, setDeletedWaterEntry] =
    useState<DayWaterEntry | null>(null);

  useEffect(() => {
    if (!deletedWaterEntry) return;
    const timeout = window.setTimeout(() => setDeletedWaterEntry(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [deletedWaterEntry]);
  useEffect(() => {
    setDeletedWaterEntry(null);
  }, [data?.date]);

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-36 pt-8 sm:px-8 lg:pb-12">
        <p aria-live="polite" className="rounded-2xl bg-card p-5 text-muted" role="status">
          {error ? "Your summary could not be loaded." : "Loading your day..."}
        </p>
        {error ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error.message}
          </p>
        ) : null}
      </main>
    );
  }

  const day = data;
  const viewingToday = selectedDate === null;
  const greetingHour = Number(
    new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: data.profile.timezone,
    }).format(new Date()),
  );
  const greeting =
    greetingHour < 12
      ? "Good morning"
      : greetingHour < 17
        ? "Good afternoon"
        : "Good evening";
  const waterGoal = data.goals?.waterMl ?? 0;
  const waterProgress =
    waterGoal > 0 ? Math.min(data.water.totalMl / waterGoal, 1) : 0;
  const nutrition = data.food.reduce(
    (totals, entry) => ({
      kcal: totals.kcal + entry.kcal * entry.servings,
      proteinG: totals.proteinG + (entry.proteinG ?? 0) * entry.servings,
    }),
    { kcal: 0, proteinG: 0 },
  );
  const weight = data.weight?.weightKg;
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${data.date}T12:00:00.000Z`));

  function runLog(input: Parameters<typeof submitLog>[0]) {
    setActionError("");
    void submitLog(input).catch((saveError: unknown) => {
      setActionError(
        saveError instanceof Error ? saveError.message : "Could not save this log.",
      );
    });
  }

  function addWater(amountMl: number) {
    runLog({ kind: "water", amountMl, loggedOn: day.date });
  }

  function logRating(kind: "mood" | "energy", value: number) {
    runLog({
      kind: "checkin",
      loggedOn: day.date,
      [kind]: value,
    });
  }

  async function deleteWater(entry: DayWaterEntry) {
    const previous = day;
    const removeEntry = (current: DayPayload | undefined): DayPayload => {
      const source = current ?? previous;
      const entries = source.water.entries.filter((item) => item.id !== entry.id);
      return {
        ...source,
        water: {
          entries,
          totalMl: entries.reduce((sum, item) => sum + item.amountMl, 0),
        },
      };
    };
    setActionError("");
    setDeletedWaterEntry(null);
    await mutate(removeEntry, { optimisticData: removeEntry, revalidate: false });
    try {
      const response = await fetch(
        `/api/water-entries/${encodeURIComponent(entry.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not delete this water entry.");
      }
      setDeletedWaterEntry(entry);
    } catch (deleteError) {
      await mutate(previous, { revalidate: false });
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this water entry.",
      );
    }
  }

  async function undoDelete() {
    if (!deletedWaterEntry) return;
    const previous = day;
    const entry = deletedWaterEntry;
    const restoreEntry = (current: DayPayload | undefined): DayPayload => {
      const source = current ?? previous;
      if (source.water.entries.some((item) => item.id === entry.id)) return source;
      const entries = [entry, ...source.water.entries];
      return {
        ...source,
        water: {
          entries,
          totalMl: entries.reduce((sum, item) => sum + item.amountMl, 0),
        },
      };
    };
    setDeletedWaterEntry(null);
    await mutate(restoreEntry, { optimisticData: restoreEntry, revalidate: false });
    try {
      const response = await fetch(
        `/api/water-entries/${encodeURIComponent(entry.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            loggedOn: entry.loggedOn,
            loggedAt: entry.loggedAt,
            amountMl: entry.amountMl,
          }),
        },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not restore this water entry.");
      }
    } catch (restoreError) {
      await mutate(previous, { revalidate: false });
      setActionError(
        restoreError instanceof Error
          ? restoreError.message
          : "Could not restore this water entry.",
      );
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-36 pt-7 sm:px-8 sm:pt-10 lg:pb-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-medium text-brand">{greeting}, {data.profile.displayName}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Today
          </h1>
          <p className="mt-2 text-sm text-muted">
            Small, steady steps are worth noticing.
          </p>
        </div>
        <DateSwitcher
          date={data.date}
          dateLabel={dateLabel}
          disabledNext={
            viewingToday || data.date >= todayFor(data.profile.timezone)
          }
          onChange={setSelectedDate}
          onToday={() => setSelectedDate(null)}
          viewingToday={viewingToday}
        />
      </header>
      {actionError ? (
        <p className="mb-4 text-sm text-red-700" role="alert">
          {actionError}
        </p>
      ) : null}

      <section aria-label="Daily progress" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.profile.hideCalories ? (
          <MetricCard
            title="Meals logged"
            value={`${data.food.length}`}
            detail="Meal entries today"
          />
        ) : (
          <MetricCard
            title="Calories"
            value={`${Math.round(nutrition.kcal)} / ${data.goals?.caloriesKcal ?? "—"} kcal`}
            detail={data.goals ? "Daily target" : "Log meals to see your total"}
            progress={
              data.goals?.caloriesKcal
                ? Math.min(nutrition.kcal / data.goals.caloriesKcal, 1)
                : undefined
            }
            progressLabel="Calorie goal progress"
          />
        )}
        <MetricCard
          title="Protein"
          value={`${Math.round(nutrition.proteinG)} g`}
          detail={data.goals ? `of ${data.goals.proteinG} g` : "Daily protein"}
          progress={
            data.goals?.proteinG
              ? Math.min(nutrition.proteinG / data.goals.proteinG, 1)
              : undefined
          }
          progressLabel="Protein goal progress"
        />
        <MetricCard
          title="Water"
          value={formatVolume(data.water.totalMl, data.profile.unitSystem)}
          detail={
            waterGoal > 0
              ? `of ${formatVolume(waterGoal, data.profile.unitSystem)}`
              : "Set a daily target"
          }
          progress={waterGoal > 0 ? waterProgress : undefined}
          progressLabel="Water goal progress"
        />
        <MetricCard
          title="Steps"
          value={data.activity ? data.activity.steps.toLocaleString() : "—"}
          detail={data.goals ? `Goal ${data.goals.steps.toLocaleString()}` : "Daily steps"}
        />
        <MetricCard
          title="Active minutes"
          value={data.activity ? `${data.activity.activeMinutes} min` : "—"}
          detail={data.goals ? `Goal ${data.goals.activeMinutes} min` : "Movement adds up"}
        />
        <MetricCard
          title="Sleep"
          value={data.sleep?.durationMin ? `${(data.sleep.durationMin / 60).toFixed(1)} h` : "—"}
          detail={data.goals ? `Goal ${(data.goals.sleepMinutes / 60).toFixed(1)} h` : "Rest is part of the picture"}
        />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-3xl border border-line bg-card p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted">Hydration</p>
              <h2 className="mt-1 text-2xl font-semibold">Water</h2>
            </div>
            <span className="text-3xl" aria-hidden="true">💧</span>
          </div>
          <div className="mt-6 flex items-end justify-between gap-4">
            <p className="text-3xl font-semibold tabular-nums">
              {formatVolume(data.water.totalMl, data.profile.unitSystem)}
            </p>
            <p className="text-sm text-muted">
              {waterGoal > 0
                ? `${formatVolume(waterGoal, data.profile.unitSystem)} goal`
                : "No goal set"}
            </p>
          </div>
          <progress
            aria-label="Water goal progress"
            className="mt-4 h-3 w-full overflow-hidden rounded-full accent-brand"
            max={waterGoal > 0 ? waterGoal : Math.max(data.water.totalMl, 1)}
            value={data.water.totalMl}
          />
          {data.water.entries.length > 0 ? (
            <ul className="mt-4 divide-y divide-line">
              {data.water.entries.slice(0, 4).map((entry) => (
                <li
                  className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm"
                  key={entry.id}
                >
                  <span>
                    {formatVolume(entry.amountMl, data.profile.unitSystem)}
                    <span className="ml-2 text-muted">
                      {new Intl.DateTimeFormat(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: data.profile.timezone,
                      }).format(new Date(entry.loggedAt))}
                    </span>
                  </span>
                  <button
                    aria-label={`Delete ${formatVolume(entry.amountMl, data.profile.unitSystem)} water entry`}
                    className="grid size-11 place-items-center rounded-full text-muted"
                    onClick={() => void deleteWater(entry)}
                    type="button"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              className="min-h-12 rounded-xl bg-brand px-4 font-semibold text-white"
              onClick={() => addWater(250)}
              type="button"
            >
              +{formatVolume(250, data.profile.unitSystem)}
            </button>
            <button
              className="min-h-12 rounded-xl border border-line px-4 font-medium"
              onClick={() => addWater(500)}
              type="button"
            >
              +{formatVolume(500, data.profile.unitSystem)}
            </button>
          </div>
          {customWaterOpen ? (
            <form
              className="mt-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const amount = Number(formData.get("amount"));
                const amountMl =
                  data.profile.unitSystem === "metric"
                    ? amount
                    : Math.round(flOzToMl(amount));
                if (amountMl > 0) {
                  addWater(amountMl);
                  setCustomWaterOpen(false);
                }
              }}
            >
              <label className="sr-only" htmlFor="custom-water">
                Custom water amount ({data.profile.unitSystem === "metric" ? "ml" : "fl oz"})
              </label>
              <input
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3"
                id="custom-water"
                inputMode="decimal"
                min="1"
                name="amount"
                required
                step="any"
                type="number"
              />
              <button className="min-h-12 rounded-xl border border-line px-4" type="submit">
                Add
              </button>
            </form>
          ) : (
            <button
              className="mt-3 min-h-11 w-full rounded-xl px-3 text-sm font-medium text-muted"
              onClick={() => setCustomWaterOpen(true)}
              type="button"
            >
              Custom amount
            </button>
          )}
        </article>

        <article className="rounded-3xl border border-line bg-card p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted">Body</p>
              <h2 className="mt-1 text-2xl font-semibold">Weight</h2>
            </div>
            <span aria-hidden="true" className="text-3xl">⚖️</span>
          </div>
          <p className="mt-7 text-3xl font-semibold tabular-nums">
            {weight == null ? "Not logged yet" : formatWeight(weight, data.profile.unitSystem)}
          </p>
          <p className="mt-2 text-sm text-muted">
            {weight == null ? "Your daily number is just one data point." : "A longer trend gives more context."}
          </p>
          <button
            className="mt-5 min-h-12 w-full rounded-xl border border-line font-medium"
            onClick={() => openQuickLog("weight")}
            type="button"
          >
            {weight == null ? "Log weight" : "Update weight"}
          </button>
        </article>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="rounded-3xl border border-line bg-card p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Nutrition</p>
              <h2 className="mt-1 text-2xl font-semibold">Meals</h2>
            </div>
            <Link className="min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-brand" href="/food">
              Open food
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {meals.map((meal) => (
              <div className="rounded-2xl border border-line p-4" key={meal}>
                <p className="font-medium">{meal}</p>
                <p className="mt-1 text-sm text-muted">No entries yet</p>
                <Link
                  aria-label={`Add ${meal.toLowerCase()}`}
                  className="mt-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-paper text-xl text-brand"
                  href={`/food?meal=${meal.toLowerCase()}`}
                >
                  +
                </Link>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-line bg-card p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Wellbeing</p>
              <h2 className="mt-1 text-2xl font-semibold">How are you feeling?</h2>
            </div>
            <span aria-hidden="true" className="text-3xl">🌿</span>
          </div>
          <RatingRow
            label="Mood"
            onSelect={(value) => logRating("mood", value)}
            options={moodOptions}
            selected={data.checkin?.mood ?? null}
          />
          <RatingRow
            label="Energy"
            onSelect={(value) => logRating("energy", value)}
            options={energyOptions}
            selected={data.checkin?.energy ?? null}
          />
        </article>
      </section>
      {deletedWaterEntry ? (
        <div
          aria-live="polite"
          className="fixed bottom-36 left-4 right-4 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg lg:bottom-8"
          role="status"
        >
          <span>Water entry deleted.</span>
          <button
            className="min-h-11 rounded-lg px-3 font-semibold underline"
            onClick={() => void undoDelete()}
            type="button"
          >
            Undo
          </button>
        </div>
      ) : null}

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="rounded-3xl border border-line bg-card p-5 sm:p-7">
          <p className="text-sm font-medium text-muted">Movement</p>
          <h2 className="mt-1 text-2xl font-semibold">Today&apos;s activity</h2>
          <p className="mt-3 text-sm text-muted">
            {data.workouts.length > 0
              ? `${data.workouts.length} activity log${data.workouts.length === 1 ? "" : "s"}`
              : "Your walks and workouts will show up here."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 font-medium text-white" href="/train">
              Log activity
            </Link>
            <button className="min-h-11 rounded-xl border border-line px-4 text-sm" disabled type="button">
              Repeat last workout
            </button>
          </div>
        </article>
        <article className="rounded-3xl border border-line bg-card p-5 sm:p-7">
          <p className="text-sm font-medium text-muted">Consistency</p>
          <h2 className="mt-1 text-2xl font-semibold">Every check-in counts</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Your personal streaks and weekly trends will build as you log over time.
          </p>
          <Link className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-medium" href="/trends">
            Explore trends
          </Link>
        </article>
      </section>
    </main>
  );
}

export function DateSwitcher({
  date,
  dateLabel,
  disabledNext,
  onChange,
  onToday,
  viewingToday,
}: {
  date: string;
  dateLabel: string;
  disabledNext: boolean;
  onChange: (date: string | null) => void;
  onToday: () => void;
  viewingToday: boolean;
}) {
  return (
    <div aria-label="Choose log date" className="flex items-center gap-1 rounded-2xl border border-line bg-card p-1">
      <button
        aria-label="Previous day"
        className="grid size-11 place-items-center rounded-xl text-xl"
        onClick={() => onChange(addDays(date, -1))}
        type="button"
      >
        ‹
      </button>
      <label className="grid min-w-28 place-items-center px-1 text-center">
        <span className="text-sm font-medium">{viewingToday ? "Today" : dateLabel}</span>
        <span className="sr-only">Select date</span>
        <input
          aria-label="Select date"
          className="w-full cursor-pointer bg-transparent text-center text-xs text-muted"
          onChange={(event) => onChange(event.target.value)}
          type="date"
          value={date}
        />
      </label>
      <button
        aria-label="Next day"
        className="grid size-11 place-items-center rounded-xl text-xl"
        disabled={disabledNext}
        onClick={() => onChange(addDays(date, 1))}
        type="button"
      >
        ›
      </button>
      {!viewingToday ? (
        <button
          className="min-h-11 rounded-xl px-2 text-xs font-medium text-brand"
          onClick={onToday}
          type="button"
        >
          Today
        </button>
      ) : null}
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  progress,
  progressLabel,
}: {
  title: string;
  value: string;
  detail: string;
  progress?: number;
  progressLabel?: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-card p-5">
      <p className="text-sm font-medium text-muted">{title}</p>
      <p className="mt-3 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
      {progress !== undefined ? (
        <progress
          aria-label={progressLabel}
          className="mt-3 h-2 w-full accent-brand"
          max={1}
          value={progress}
        />
      ) : null}
    </article>
  );
}

function RatingRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: typeof moodOptions;
  selected: number | null;
  onSelect: (value: number) => void;
}) {
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-5 gap-2">
        {options.map((option) => (
          <button
            aria-label={`${label}: ${option.label}`}
            aria-pressed={selected === option.value}
            className={`min-h-12 rounded-xl border text-2xl ${
              selected === option.value ? "border-brand bg-brand/10" : "border-line bg-paper"
            }`}
            key={option.value}
            onClick={() => onSelect(option.value)}
            type="button"
          >
            {option.icon}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
