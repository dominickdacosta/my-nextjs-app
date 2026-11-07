"use client";

import { useEffect, useState, type FormEvent } from "react";
import useSWR, { useSWRConfig } from "swr";
import { DateSwitcher } from "@/components/today-dashboard";
import { useAppContext } from "@/components/app-shell";
import type { DayPayload } from "@/lib/health/day";
import RunTracker from "@/components/run-tracker";
import StravaPanel from "@/components/strava-panel";
import { RunRoutePreview } from "@/components/run-tracker";
import { addDays, dateRange, todayFor, weekStart } from "@/lib/health/dates";
import type {
  ExerciseSearchResult,
  TrainingType,
  WorkoutRecord,
} from "@/lib/health/workouts";
import {
  formatDistance,
  kgToLb,
  kilometersToMeters,
  lbToKg,
  milesToMeters,
} from "@/lib/health/units";
import { decodeEncodedPolyline } from "@/lib/health/running";

const typeLabels: Record<TrainingType, string> = {
  strength: "Strength",
  cardio: "Cardio",
  walk: "Walk",
  run: "Run",
  other: "Other",
};
const quickActivities = [
  { title: "Weight training", type: "strength" },
  { title: "Football", type: "cardio" },
  { title: "Walking", type: "walk" },
  { title: "Running", type: "run" },
  { title: "Cycling", type: "cardio" },
  { title: "Swimming", type: "cardio" },
  { title: "Other", type: "other" },
] as const;
type WorkoutTemplate = {
  id: string;
  name: string;
  exercises: Array<{
    exerciseId: string;
    name: string;
    targetSets: number;
    targetReps: number;
    targetWeightKg: number | null;
  }>;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load your training history.");
  return (await response.json()) as T;
}

function dayKey(date: string | null): string {
  return date ? `/api/day?date=${encodeURIComponent(date)}` : "/api/day";
}

function optionalNumber(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

export default function TrainPage() {
  const {
    selectedDate,
    setSelectedDate,
    trainingType,
    trainingQuickOpen,
    setTrainingQuickOpen,
  } = useAppContext();
  const { mutate: mutateCache } = useSWRConfig();
  const { data: day, error: dayError } = useSWR<DayPayload>(
    dayKey(selectedDate),
    fetchJson,
  );
  const from = day ? weekStart(day.date) : null;
  const to = from ? addDays(from, 6) : null;
  const workoutsKey =
    from && to
      ? `/api/workouts?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      : null;
  const {
    data: workouts,
    error: workoutError,
    isLoading: workoutsLoading,
    mutate: mutateWorkouts,
  } = useSWR<WorkoutRecord[]>(workoutsKey, fetchJson);
  const {
    data: templates,
    error: templateError,
    mutate: mutateTemplates,
  } = useSWR<WorkoutTemplate[]>("/api/workout-templates", fetchJson);
  const [formOpen, setFormOpen] = useState(false);
  const [quickFormOpen, setQuickFormOpen] = useState(false);
  const [quickActivity, setQuickActivity] = useState<string>("Walking");
  const [quickDuration, setQuickDuration] = useState("30");
  const [quickNotes, setQuickNotes] = useState("");
  const [type, setType] = useState<TrainingType>(trainingType);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [steps, setSteps] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [calories, setCalories] = useState("");
  const [effort, setEffort] = useState("");
  const [notes, setNotes] = useState("");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseResults, setExerciseResults] = useState<ExerciseSearchResult[]>([]);
  const [exerciseId, setExerciseId] = useState("");
  const [exerciseName, setExerciseName] = useState("");
  const [setCount, setSetCount] = useState("3");
  const [reps, setReps] = useState("8");
  const [weight, setWeight] = useState("");
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [exerciseError, setExerciseError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deletedWorkout, setDeletedWorkout] = useState<WorkoutRecord | null>(null);

  useEffect(() => {
    if (!trainingQuickOpen) return;
    setType(trainingType);
    setQuickFormOpen(true);
    setTrainingQuickOpen(false);
  }, [setTrainingQuickOpen, trainingQuickOpen, trainingType]);

  useEffect(() => {
    if (!deletedWorkout) return;
    const timeout = window.setTimeout(() => setDeletedWorkout(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [deletedWorkout]);

  useEffect(() => {
    if (exerciseId) return;
    const query = exerciseSearch.trim();
    if (query.length < 2) {
      setExerciseResults([]);
      setExerciseError("");
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setExerciseLoading(true);
      setExerciseError("");
      void fetch(`/api/exercises?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const result = (await response.json()) as { error?: string };
            throw new Error(result.error ?? "Could not search exercises.");
          }
          return (await response.json()) as ExerciseSearchResult[];
        })
        .then(setExerciseResults)
        .catch((searchError: unknown) => {
          if (controller.signal.aborted) return;
          setExerciseError(
            searchError instanceof Error
              ? searchError.message
              : "Could not search exercises.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setExerciseLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [exerciseId, exerciseSearch]);

  if (!day) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-36 pt-8 sm:px-8 lg:pb-12">
        <p aria-live="polite" className="rounded-2xl bg-card p-5 text-muted" role="status">
          {dayError ? "Your training log could not be loaded." : "Loading your training log..."}
        </p>
        {dayError ? <p className="mt-3 text-sm text-red-700" role="alert">{dayError.message}</p> : null}
      </main>
    );
  }

  const dayData = day;
  const weekDates = dateRange(weekStart(day.date), addDays(weekStart(day.date), 6));
  const weekWorkouts = workouts ?? [];
  const today = todayFor(day.profile.timezone);
  const viewingToday = selectedDate === null;
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day.date}T12:00:00.000Z`));
  const dayWorkouts = weekWorkouts.filter((workout) => workout.loggedOn === day.date);
  const weeklyMinutes = weekWorkouts.reduce(
    (total, workout) => total + (workout.durationMin ?? 0),
    0,
  );

  function resetForm() {
    setFormOpen(false);
    setTitle("");
    setDuration("");
    setDistance("");
    setSteps("");
    setHeartRate("");
    setCalories("");
    setEffort("");
    setNotes("");
    setExerciseSearch("");
    setExerciseResults([]);
    setExerciseId("");
    setExerciseName("");
    setSetCount("3");
    setReps("8");
    setWeight("");
  }

  function chooseExercise(exercise: ExerciseSearchResult) {
    setExerciseId(exercise.id);
    setExerciseName(exercise.name);
    setExerciseSearch("");
    setExerciseResults([]);
  }

  async function saveWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    const setTotal = exerciseId && type === "strength" ? Number(setCount) : 0;
    if (
      exerciseId &&
      type === "strength" &&
      (!Number.isInteger(setTotal) || setTotal < 1 || setTotal > 100)
    ) {
      setActionError("Choose between 1 and 100 exercise sets.");
      return;
    }
    const distanceM =
      distance.trim() === ""
        ? null
        : dayData.profile.unitSystem === "metric"
          ? Math.round(kilometersToMeters(Number(distance)))
          : Math.round(milesToMeters(Number(distance)));
    const weightKg = optionalNumber(weight);
    const result = {
      loggedOn: dayData.date,
      type,
      title: title.trim() || null,
      durationMin: optionalNumber(duration),
      distanceM,
      steps: optionalNumber(steps),
      avgHeartRate: optionalNumber(heartRate),
      caloriesBurned: optionalNumber(calories),
      caloriesEstimated: false,
      perceivedEffort: optionalNumber(effort),
      notes: notes.trim() || null,
      sets:
        exerciseId && type === "strength" && setTotal > 0
          ? Array.from({ length: setTotal }, () => ({
              exerciseId,
              reps: optionalNumber(reps),
              weightKg:
                weightKg === null
                  ? null
                  : dayData.profile.unitSystem === "metric"
                    ? weightKg
                    : lbToKg(weightKg),
            }))
          : [],
    };

    try {
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!response.ok) {
        const errorResult = (await response.json()) as { error?: string };
        throw new Error(errorResult.error ?? "Could not save this workout.");
      }
      resetForm();
      try {
        await mutateWorkouts();
        await mutateCache(dayKey(selectedDate));
      } catch {
        setActionError("Activity was saved, but the history could not refresh.");
      }
    } catch (saveError) {
      setActionError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this workout.",
      );
    }
  }

  async function saveQuickActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    const activity = quickActivities.find((item) => item.title === quickActivity);
    if (!activity) {
      setActionError("Choose an activity type.");
      return;
    }
    try {
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loggedOn: dayData.date,
          type: activity.type,
          title: activity.title,
          durationMin: Number(quickDuration),
          caloriesEstimated: false,
          notes: quickNotes.trim() || null,
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not save this activity.");
      }
      setQuickFormOpen(false);
      setQuickDuration("30");
      setQuickNotes("");
      await mutateWorkouts();
      await mutateCache(dayKey(selectedDate));
    } catch (saveError) {
      setActionError(
        saveError instanceof Error ? saveError.message : "Could not save this activity.",
      );
    }
  }

  async function repeatLastStrengthWorkout() {
    const previous = weekWorkouts.find(
      (workout) => workout.type === "strength" && workout.source !== "strava",
    );
    if (!previous) return;
    setActionError("");
    try {
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loggedOn: dayData.date,
          type: previous.type,
          title: previous.title,
          durationMin: previous.durationMin,
          durationSeconds: previous.durationSeconds,
          caloriesEstimated: false,
          notes: previous.notes,
          sets: previous.sets.map((set) => ({
            exerciseId: set.exerciseId,
            reps: set.reps,
            weightKg: set.weightKg,
            durationS: set.durationS,
            distanceM: set.distanceM,
            rpe: set.rpe,
            isWarmup: set.isWarmup,
          })),
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not repeat this workout.");
      }
      await mutateWorkouts();
      await mutateCache(dayKey(selectedDate));
    } catch (repeatError) {
      setActionError(
        repeatError instanceof Error
          ? repeatError.message
          : "Could not repeat this workout.",
      );
    }
  }

  async function saveLastStrengthAsTemplate() {
    const previous = weekWorkouts.find(
      (workout) => workout.type === "strength" && workout.source !== "strava",
    );
    if (!previous) return;
    const byExercise = new Map<string, typeof previous.sets>();
    for (const set of previous.sets) {
      if (!set.exerciseId) continue;
      byExercise.set(set.exerciseId, [
        ...(byExercise.get(set.exerciseId) ?? []),
        set,
      ]);
    }
    const exercises = Array.from(byExercise, ([exerciseId, sets]) => ({
      exerciseId,
      targetSets: sets.length,
      targetReps: sets[0].reps ?? 0,
      targetWeightKg: sets[sets.length - 1].weightKg,
    }));
    if (!exercises.length) {
      setActionError("Log exercise sets before saving a workout template.");
      return;
    }
    setActionError("");
    try {
      const response = await fetch("/api/workout-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${previous.title || "Strength"} template`,
          exercises,
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not save this template.");
      }
      await mutateTemplates();
    } catch (saveError) {
      setActionError(
        saveError instanceof Error ? saveError.message : "Could not save this template.",
      );
    }
  }

  async function startTemplate(template: WorkoutTemplate) {
    setActionError("");
    try {
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loggedOn: dayData.date,
          type: "strength",
          title: template.name,
          caloriesEstimated: false,
          sets: template.exercises.flatMap((exercise) =>
            Array.from({ length: exercise.targetSets }, () => ({
              exerciseId: exercise.exerciseId,
              reps: exercise.targetReps,
              weightKg: exercise.targetWeightKg,
            })),
          ),
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not start this template.");
      }
      await mutateWorkouts();
      await mutateCache(dayKey(selectedDate));
    } catch (startError) {
      setActionError(
        startError instanceof Error ? startError.message : "Could not start this template.",
      );
    }
  }

  async function deleteTemplate(templateId: string) {
    setActionError("");
    try {
      const response = await fetch(`/api/workout-templates/${encodeURIComponent(templateId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not delete this template.");
      }
      await mutateTemplates();
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error ? deleteError.message : "Could not delete this template.",
      );
    }
  }

  async function deleteWorkout(workout: WorkoutRecord) {
    const previous = weekWorkouts;
    const remove = (current: WorkoutRecord[] | undefined): WorkoutRecord[] =>
      (current ?? previous).filter((entry) => entry.id !== workout.id);
    setActionError("");
    setDeletedWorkout(null);
    await mutateWorkouts(remove, { optimisticData: remove, revalidate: false });
    try {
      const response = await fetch(
        `/api/workouts/${encodeURIComponent(workout.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not delete this workout.");
      }
      setDeletedWorkout(workout);
      void mutateCache(dayKey(selectedDate)).catch(() =>
        setActionError("Activity was deleted, but the daily summary could not refresh."),
      );
    } catch (deleteError) {
      await mutateWorkouts(previous, { revalidate: false });
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this workout.",
      );
    }
  }

  async function undoDelete() {
    if (!deletedWorkout) return;
    const previous = weekWorkouts;
    const workout = deletedWorkout;
    const restore = (current: WorkoutRecord[] | undefined): WorkoutRecord[] => {
      const source = current ?? previous;
      return source.some((entry) => entry.id === workout.id)
        ? source
        : [workout, ...source];
    };
    setDeletedWorkout(null);
    await mutateWorkouts(restore, { optimisticData: restore, revalidate: false });
    try {
      const response = await fetch(
        `/api/workouts/${encodeURIComponent(workout.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(workout),
        },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not restore this workout.");
      }
      void mutateCache(dayKey(selectedDate)).catch(() =>
        setActionError("Activity was restored, but the daily summary could not refresh."),
      );
    } catch (restoreError) {
      await mutateWorkouts(previous, { revalidate: false });
      setActionError(
        restoreError instanceof Error
          ? restoreError.message
          : "Could not restore this workout.",
      );
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-36 pt-7 sm:px-8 sm:pt-10 lg:pb-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-medium text-brand">Movement</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Train</h1>
          <p className="mt-2 text-sm text-muted">Strength, cardio, and everyday movement.</p>
        </div>
        <DateSwitcher
          date={day.date}
          dateLabel={dateLabel}
          disabledNext={viewingToday || day.date >= today}
          onChange={setSelectedDate}
          onToday={() => setSelectedDate(null)}
          viewingToday={viewingToday}
        />
      </header>

      {actionError ? <p className="mb-4 text-sm text-red-700" role="alert">{actionError}</p> : null}
      {workoutError ? <p className="mb-4 text-sm text-red-700" role="alert">{workoutError.message}</p> : null}
      {templateError ? <p className="mb-4 text-sm text-red-700" role="alert">{templateError.message}</p> : null}
      <StravaPanel
        onSynced={() => {
          void Promise.all([
            mutateWorkouts(),
            mutateCache(dayKey(selectedDate)),
          ]).catch(() => setActionError("Strava synced, but your activity view could not refresh."));
        }}
      />
      {viewingToday ? (
        <RunTracker
          date={day.date}
          onSaved={() => {
            void Promise.all([
              mutateWorkouts(),
              mutateCache(dayKey(selectedDate)),
            ]).catch(() => setActionError("Run saved, but your activity view could not refresh."));
          }}
          unitSystem={day.profile.unitSystem}
          weightKg={day.weight?.weightKg ?? null}
        />
      ) : null}

      <section aria-label="Weekly training history" className="rounded-3xl border border-line bg-card p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted">This week</p>
            <h2 className="mt-1 text-2xl font-semibold">
              {weekWorkouts.length} {weekWorkouts.length === 1 ? "workout" : "workouts"}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted">{weeklyMinutes} active minutes</p>
            {weekWorkouts.some((workout) => workout.type === "strength" && workout.source !== "strava") ? (
              <>
                <button
                  className="min-h-11 rounded-xl border border-line px-3 text-sm font-medium"
                  onClick={() => void repeatLastStrengthWorkout()}
                  type="button"
                >
                  Repeat last strength workout
                </button>
                <button
                  className="min-h-11 rounded-xl border border-line px-3 text-sm font-medium"
                  onClick={() => void saveLastStrengthAsTemplate()}
                  type="button"
                >
                  Save as template
                </button>
              </>
            ) : null}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-7 gap-2">
          {weekDates.map((date) => {
            const count = weekWorkouts.filter((workout) => workout.loggedOn === date).length;
            const active = day.date === date;
            const label = new Intl.DateTimeFormat(undefined, {
              weekday: "short",
              timeZone: "UTC",
            }).format(new Date(`${date}T12:00:00.000Z`));
            return (
              <button
                aria-pressed={active}
                className={`min-h-20 rounded-2xl border px-1 py-2 text-center ${
                  active ? "border-brand bg-brand/10 text-brand" : "border-line"
                }`}
                disabled={date > today}
                key={date}
                onClick={() => setSelectedDate(date === today ? null : date)}
                type="button"
              >
                <span className="block text-xs">{label}</span>
                <span className="mt-1 block text-sm font-semibold tabular-nums">
                  {Number(date.slice(-2))}
                </span>
                <span className="mt-1 block text-xs text-muted">
                  {count ? `${count} ${count === 1 ? "log" : "logs"}` : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {templates?.length ? (
        <section aria-label="Workout templates" className="mt-5 rounded-3xl border border-line bg-card p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Workout templates</h2>
          <ul className="mt-3 divide-y divide-line">
            {templates.map((template) => (
              <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={template.id}>
                <div>
                  <p className="font-medium">{template.name}</p>
                  <p className="text-sm text-muted">
                    {template.exercises.map((exercise) => `${exercise.name} · ${exercise.targetSets} × ${exercise.targetReps}`).join("; ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="min-h-11 rounded-xl bg-brand px-3 text-sm font-medium text-white" onClick={() => void startTemplate(template)} type="button">Start</button>
                  <button className="min-h-11 rounded-xl border border-line px-3 text-sm" onClick={() => void deleteTemplate(template.id)} type="button">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-5 rounded-3xl border border-line bg-card p-5 sm:p-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{dateLabel}</p>
            <h2 className="mt-1 text-2xl font-semibold">Your activity</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-xl bg-brand px-4 font-medium text-white"
              onClick={() => setQuickFormOpen(true)}
              type="button"
            >
              Quick log
            </button>
            <button
              className="min-h-11 rounded-xl border border-line px-4 font-medium"
              onClick={() => {
                setType(trainingType);
                setFormOpen(true);
              }}
              type="button"
            >
              Detailed log
            </button>
          </div>
        </header>

        {quickFormOpen ? (
          <form
            className="mt-5 grid gap-4 rounded-2xl border border-line p-4 sm:grid-cols-2 sm:p-5"
            onSubmit={(event) => void saveQuickActivity(event)}
          >
            <label className="grid gap-2 text-sm font-medium">
              Activity
              <select
                className="min-h-12 rounded-xl border border-line bg-paper px-3"
                onChange={(event) => setQuickActivity(event.target.value)}
                value={quickActivity}
              >
                {quickActivities.map((activity) => (
                  <option key={activity.title} value={activity.title}>{activity.title}</option>
                ))}
              </select>
            </label>
            <TrainingInput
              label="Duration (minutes)"
              min="1"
              onChange={setQuickDuration}
              required
              step="1"
              type="number"
              value={quickDuration}
            />
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">
              Notes (optional)
              <textarea
                className="min-h-16 rounded-xl border border-line bg-paper p-3"
                maxLength={2000}
                onChange={(event) => setQuickNotes(event.target.value)}
                value={quickNotes}
              />
            </label>
            <p className="text-xs text-muted sm:col-span-2">
              Calories are estimated only when your latest logged weight and activity type support an estimate.
            </p>
            <div className="flex gap-3 sm:col-span-2">
              <button className="min-h-11 rounded-xl bg-brand px-4 font-medium text-white" type="submit">Save activity</button>
              <button className="min-h-11 rounded-xl border border-line px-4" onClick={() => setQuickFormOpen(false)} type="button">Cancel</button>
            </div>
          </form>
        ) : null}

        {formOpen ? (
          <form className="mt-5 grid gap-4 rounded-2xl border border-line p-4 sm:grid-cols-2 sm:p-5" onSubmit={(event) => void saveWorkout(event)}>
            <label className="grid gap-2 text-sm font-medium">
              Activity type
              <select className="min-h-12 rounded-xl border border-line bg-paper px-3" onChange={(event) => setType(event.target.value as TrainingType)} value={type}>
                {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <TrainingInput label="Name (optional)" onChange={setTitle} value={title} />
            <TrainingInput label="Duration (minutes)" min="1" onChange={setDuration} step="1" type="number" value={duration} />
            <TrainingInput
              label={`Distance (${day.profile.unitSystem === "metric" ? "km" : "mi"})`}
              min="0"
              onChange={setDistance}
              step="0.01"
              type="number"
              value={distance}
            />
            <TrainingInput label="Steps (optional)" min="0" onChange={setSteps} step="1" type="number" value={steps} />
            <TrainingInput label="Average heart rate (bpm)" min="30" max="250" onChange={setHeartRate} step="1" type="number" value={heartRate} />
            <TrainingInput label="Calories burned (optional)" min="0" onChange={setCalories} step="1" type="number" value={calories} />
            <label className="grid gap-2 text-sm font-medium">
              Effort (1–10)
              <select className="min-h-12 rounded-xl border border-line bg-paper px-3" onChange={(event) => setEffort(event.target.value)} value={effort}>
                <option value="">Not set</option>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>

            {type === "strength" ? (
              <div className="grid gap-3 rounded-xl border border-line p-4 sm:col-span-2 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <h3 className="font-semibold">Exercise sets</h3>
                  <p className="mt-1 text-xs text-muted">Optional. Search the exercise library to add a simple set record.</p>
                </div>
                {exerciseName ? (
                  <p className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
                    <span className="font-medium">{exerciseName}</span>
                    <button className="text-muted underline" onClick={() => { setExerciseId(""); setExerciseName(""); }} type="button">Change</button>
                  </p>
                ) : (
                  <div className="grid gap-2 sm:col-span-2">
                    <label className="text-sm font-medium" htmlFor="exercise-search">Exercise</label>
                    <input
                      autoComplete="off"
                      className="min-h-11 rounded-xl border border-line bg-paper px-3"
                      id="exercise-search"
                      onChange={(event) => setExerciseSearch(event.target.value)}
                      placeholder="Bench press, squat..."
                      value={exerciseSearch}
                    />
                    {exerciseLoading ? <p aria-live="polite" className="text-xs text-muted" role="status">Searching exercises...</p> : null}
                    {exerciseError ? <p className="text-xs text-red-700" role="alert">{exerciseError}</p> : null}
                    {exerciseResults.length ? (
                      <ul className="max-h-40 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                        {exerciseResults.map((exercise) => (
                          <li key={exercise.id}>
                            <button className="min-h-10 w-full px-3 text-left text-sm hover:bg-paper" onClick={() => chooseExercise(exercise)} type="button">
                              {exercise.name}
                              {exercise.equipment ? <span className="ml-2 text-xs text-muted">{exercise.equipment}</span> : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )}
                {exerciseId ? (
                  <>
                    <TrainingInput label="Sets" min="1" max="100" onChange={setSetCount} step="1" type="number" value={setCount} />
                    <TrainingInput label="Reps per set" min="0" onChange={setReps} step="1" type="number" value={reps} />
                    <TrainingInput label={`Weight (${day.profile.unitSystem === "metric" ? "kg" : "lb"})`} min="0" onChange={setWeight} step="0.1" type="number" value={weight} />
                  </>
                ) : null}
              </div>
            ) : null}

            <label className="grid gap-2 text-sm font-medium sm:col-span-2">
              Notes
              <textarea className="min-h-20 rounded-xl border border-line bg-paper p-3" maxLength={2000} onChange={(event) => setNotes(event.target.value)} value={notes} />
            </label>
            <div className="flex gap-3 sm:col-span-2">
              <button className="min-h-12 rounded-xl bg-brand px-5 font-semibold text-white" type="submit">Save activity</button>
              <button className="min-h-12 rounded-xl border border-line px-5" onClick={resetForm} type="button">Cancel</button>
            </div>
          </form>
        ) : null}

        {workoutsLoading ? <p aria-live="polite" className="mt-5 text-sm text-muted" role="status">Loading activity...</p> : null}
        {dayWorkouts.length ? (
          <ul className="mt-5 divide-y divide-line">
            {dayWorkouts.map((workout) => (
              <li className="flex items-start justify-between gap-4 py-4" key={workout.id}>
                <div>
                  <p className="font-semibold">{workout.title || typeLabels[workout.type]}</p>
                  <p className="mt-1 text-sm text-muted">
                    {[
                      typeLabels[workout.type],
                      workout.durationMin !== null ? `${workout.durationMin} min` : null,
                      workout.distanceM ? formatDistance(workout.distanceM, day.profile.unitSystem) : null,
                      workout.avgPaceSecPerKm !== null
                        ? `${Math.floor(workout.avgPaceSecPerKm / 60)}:${String(workout.avgPaceSecPerKm % 60).padStart(2, "0")} / km`
                        : null,
                      workout.caloriesBurned !== null
                        ? `${workout.caloriesEstimated ? "~" : ""}${workout.caloriesBurned} kcal`
                        : null,
                      workout.sets.length ? `${workout.sets.length} sets` : null,
                    ].filter(Boolean).join(" · ")}
                  </p>
                  {workout.elevationM ? (
                    <p className="mt-1 text-xs text-muted">Elevation gain: {workout.elevationM} m</p>
                  ) : null}
                  {workout.routePoints?.length || workout.routePolyline ? (
                    <RouteSummary workout={workout} />
                  ) : null}
                  {workout.sets.length ? (
                    <p className="mt-1 text-xs text-muted">
                      {workout.sets[0].exerciseName ?? "Exercise"}
                      {workout.sets[0].reps !== null ? ` · ${workout.sets[0].reps} reps` : ""}
                      {workout.sets[0].weightKg !== null
                        ? ` · ${day.profile.unitSystem === "metric"
                            ? `${workout.sets[0].weightKg} kg`
                            : `${kgToLb(workout.sets[0].weightKg).toFixed(1)} lb`}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <button
                  aria-label={`Delete ${workout.title || typeLabels[workout.type]}`}
                  className="min-h-11 rounded-lg px-3 text-sm text-muted underline"
                  onClick={() => void deleteWorkout(workout)}
                  type="button"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-muted">No activities logged for this day yet.</p>
        )}
      </section>

      {deletedWorkout ? (
        <div aria-live="polite" className="fixed bottom-36 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg lg:bottom-8" role="status">
          <span>Activity deleted.</span>
          <button className="min-h-11 rounded-lg px-3 font-semibold underline" onClick={() => void undoDelete()} type="button">Undo</button>
        </div>
      ) : null}
    </main>
  );
}

function RouteSummary({ workout }: { workout: WorkoutRecord }) {
  const points =
    workout.routePoints ??
    (workout.routePolyline ? decodeEncodedPolyline(workout.routePolyline) : []);
  if (!points.length && !workout.routePolyline) return null;
  return (
    <div className="mt-2 max-w-sm">
      <RunRoutePreview
        compact
        label={`${workout.title ?? "Workout"} route preview`}
        points={points}
      />
    </div>
  );
}

function TrainingInput({
  label,
  onChange,
  type = "text",
  ...props
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "number" | "text";
  value: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="min-h-12 rounded-xl border border-line bg-paper px-3"
        onChange={(event) => onChange(event.target.value)}
        required={props.required}
        type={type}
        {...props}
      />
    </label>
  );
}
