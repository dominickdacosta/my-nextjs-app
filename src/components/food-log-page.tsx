"use client";

import { useEffect, useState, type FormEvent } from "react";
import useSWR from "swr";
import { DateSwitcher } from "@/components/today-dashboard";
import { useAppContext } from "@/components/app-shell";
import type { DayFoodEntry, DayPayload } from "@/lib/health/day";
import type { FoodSearchResult } from "@/lib/health/food-search";
import { todayFor } from "@/lib/health/dates";

const meals = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snacks" },
] as const;

async function fetchDay(url: string): Promise<DayPayload> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load your food log.");
  return (await response.json()) as DayPayload;
}

function dayKey(date: string | null): string {
  return date ? `/api/day?date=${encodeURIComponent(date)}` : "/api/day";
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
    value,
  );
}

export default function FoodLogPage() {
  const { selectedDate, setSelectedDate } = useAppContext();
  const { data, error, isLoading, mutate } = useSWR<DayPayload>(
    dayKey(selectedDate),
    fetchDay,
  );
  const [activeMeal, setActiveMeal] = useState<
    DayFoodEntry["meal"] | null
  >(null);
  const [name, setName] = useState("");
  const [servings, setServings] = useState("1");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [deletedEntry, setDeletedEntry] = useState<DayFoodEntry | null>(null);

  useEffect(() => {
    if (!deletedEntry) return;
    const timeout = window.setTimeout(() => setDeletedEntry(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [deletedEntry]);

  useEffect(() => {
    setDeletedEntry(null);
  }, [data?.date]);

  useEffect(() => {
    const query = searchText.trim();
    if (!activeMeal || query.length < 2) {
      setSearchResults([]);
      setSearchError("");
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError("");
      void fetch(`/api/foods/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const result = (await response.json()) as { error?: string };
            throw new Error(result.error ?? "Could not search foods.");
          }
          return (await response.json()) as { results: FoodSearchResult[] };
        })
        .then((result) => setSearchResults(result.results))
        .catch((searchFailure: unknown) => {
          if (controller.signal.aborted) return;
          setSearchError(
            searchFailure instanceof Error
              ? searchFailure.message
              : "Could not search foods.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [activeMeal, searchText]);

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-36 pt-8 sm:px-8 lg:pb-12">
        <p aria-live="polite" className="rounded-2xl bg-card p-5 text-muted" role="status">
          {error ? "Your food log could not be loaded." : "Loading your food log..."}
        </p>
        {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error.message}</p> : null}
      </main>
    );
  }

  const day = data;
  const totals = day.food.reduce(
    (result, entry) => ({
      kcal: result.kcal + entry.kcal * entry.servings,
      proteinG: result.proteinG + (entry.proteinG ?? 0) * entry.servings,
      carbsG: result.carbsG + (entry.carbsG ?? 0) * entry.servings,
      fatG: result.fatG + (entry.fatG ?? 0) * entry.servings,
      fiberG: result.fiberG + (entry.fiberG ?? 0) * entry.servings,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  );
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day.date}T12:00:00.000Z`));
  const viewingToday = selectedDate === null;

  function clearForm() {
    setName("");
    setServings("1");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setFiber("");
    setSearchText("");
    setSearchResults([]);
    setActiveMeal(null);
  }

  function chooseSearchResult(result: FoodSearchResult) {
    setName(result.name);
    setServings("1");
    setCalories(result.kcal === null ? "" : String(result.kcal));
    setProtein(result.proteinG === null ? "" : String(result.proteinG));
    setCarbs(result.carbsG === null ? "" : String(result.carbsG));
    setFat(result.fatG === null ? "" : String(result.fatG));
    setFiber(result.fiberG === null ? "" : String(result.fiberG));
    setSearchText("");
    setSearchResults([]);
  }

  async function addFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeMeal) return;
    setActionError("");
    setNotice("");
    const numberOrNull = (value: string) =>
      value.trim() ? Number(value) : null;
    try {
      const response = await fetch("/api/food-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loggedOn: day.date,
          meal: activeMeal,
          name,
          servings: Number(servings),
          kcal: Number(calories || 0),
          proteinG: numberOrNull(protein),
          carbsG: numberOrNull(carbs),
          fatG: numberOrNull(fat),
          fiberG: numberOrNull(fiber),
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not save this food entry.");
      }
      clearForm();
      setNotice("Food entry saved.");
      try {
        await mutate();
      } catch {
        setActionError("Food was saved, but your summary could not refresh.");
      }
    } catch (saveError) {
      setActionError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this food entry.",
      );
    }
  }

  async function deleteFood(entry: DayFoodEntry) {
    const previous = day;
    const removeEntry = (current: DayPayload | undefined): DayPayload => {
      const source = current ?? previous;
      return {
        ...source,
        food: source.food.filter((item) => item.id !== entry.id),
      };
    };
    setActionError("");
    setDeletedEntry(null);
    await mutate(removeEntry, { optimisticData: removeEntry, revalidate: false });
    try {
      const response = await fetch(
        `/api/food-entries/${encodeURIComponent(entry.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not delete this food entry.");
      }
      setDeletedEntry(entry);
    } catch (deleteError) {
      await mutate(previous, { revalidate: false });
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this food entry.",
      );
    }
  }

  async function undoDelete() {
    if (!deletedEntry) return;
    const previous = day;
    const entry = deletedEntry;
    const restoreEntry = (current: DayPayload | undefined): DayPayload => {
      const source = current ?? previous;
      if (source.food.some((item) => item.id === entry.id)) return source;
      return { ...source, food: [entry, ...source.food] };
    };
    setDeletedEntry(null);
    await mutate(restoreEntry, { optimisticData: restoreEntry, revalidate: false });
    try {
      const response = await fetch(
        `/api/food-entries/${encodeURIComponent(entry.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not restore this food entry.");
      }
    } catch (restoreError) {
      await mutate(previous, { revalidate: false });
      setActionError(
        restoreError instanceof Error
          ? restoreError.message
          : "Could not restore this food entry.",
      );
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-36 pt-7 sm:px-8 sm:pt-10 lg:pb-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-medium text-brand">Nutrition</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Food</h1>
          <p className="mt-2 text-sm text-muted">
            Log meals and see how your day adds up.
          </p>
        </div>
        <DateSwitcher
          date={day.date}
          dateLabel={dateLabel}
          disabledNext={viewingToday || day.date >= todayFor(day.profile.timezone)}
          onChange={setSelectedDate}
          onToday={() => setSelectedDate(null)}
          viewingToday={viewingToday}
        />
      </header>

      {actionError ? <p className="mb-4 text-sm text-red-700" role="alert">{actionError}</p> : null}
      {notice ? <p aria-live="polite" className="mb-4 text-sm text-brand" role="status">{notice}</p> : null}

      <section aria-label="Nutrition summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NutritionCard
          label="Calories"
          value={day.profile.hideCalories ? "Hidden" : formatAmount(totals.kcal)}
          goal={day.profile.hideCalories ? null : day.goals?.caloriesKcal ?? null}
          unit={day.profile.hideCalories ? "" : "kcal"}
        />
        <NutritionCard label="Protein" value={formatAmount(totals.proteinG)} goal={day.goals?.proteinG ?? null} unit="g" />
        <NutritionCard label="Carbs" value={formatAmount(totals.carbsG)} goal={day.goals?.carbsG ?? null} unit="g" />
        <NutritionCard label="Fat" value={formatAmount(totals.fatG)} goal={day.goals?.fatG ?? null} unit="g" />
      </section>
      {day.goals ? (
        <p className="mt-3 text-sm text-muted">
          Fiber: {formatAmount(totals.fiberG)} / {day.goals.fiberG} g
        </p>
      ) : null}

      {activeMeal ? (
        <form
          className="mt-6 grid gap-4 rounded-3xl border border-line bg-card p-5 sm:grid-cols-2 sm:p-7"
          onSubmit={(event) => void addFood(event)}
        >
          <div className="sm:col-span-2">
            <h2 className="text-xl font-semibold">
              Add to {meals.find((meal) => meal.id === activeMeal)?.label}
            </h2>
            <p className="mt-1 text-sm text-muted">Nutrition values are per serving.</p>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <label className="text-sm font-medium" htmlFor="food-search">
              Search your recent foods and FoodData Central
            </label>
            <input
              autoComplete="off"
              className="min-h-12 rounded-xl border border-line bg-paper px-3 text-base"
              id="food-search"
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Try oatmeal or yogurt"
              type="search"
              value={searchText}
            />
            {searchLoading ? <p aria-live="polite" className="text-sm text-muted" role="status">Searching foods...</p> : null}
            {searchError ? <p className="text-sm text-red-700" role="alert">{searchError}</p> : null}
            {searchResults.length ? (
              <ul aria-label="Food search results" className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-paper">
                {searchResults.map((result) => (
                  <li key={result.id}>
                    <button
                      className="min-h-14 w-full px-3 py-2 text-left hover:bg-card"
                      onClick={() => chooseSearchResult(result)}
                      type="button"
                    >
                      <span className="block font-medium">{result.name}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {[
                          result.brand,
                          result.servingSize !== null
                            ? `${formatAmount(result.servingSize)} ${result.servingUnit ?? ""}`.trim()
                            : null,
                          !day.profile.hideCalories && result.kcal !== null
                            ? `${formatAmount(result.kcal)} kcal`
                            : null,
                        ].filter(Boolean).join(" · ") || (result.source === "history" ? "Previous food" : "FoodData Central")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <FoodInput label="Food name" onChange={setName} required value={name} />
          <FoodInput label="Servings" min="0.1" onChange={setServings} required step="0.1" type="number" value={servings} />
          {!day.profile.hideCalories ? (
            <FoodInput label="Calories (kcal)" min="0" onChange={setCalories} step="1" type="number" value={calories} />
          ) : null}
          <FoodInput label="Protein (g)" min="0" onChange={setProtein} step="0.1" type="number" value={protein} />
          <FoodInput label="Carbohydrates (g)" min="0" onChange={setCarbs} step="0.1" type="number" value={carbs} />
          <FoodInput label="Fat (g)" min="0" onChange={setFat} step="0.1" type="number" value={fat} />
          <FoodInput label="Fiber (g)" min="0" onChange={setFiber} step="0.1" type="number" value={fiber} />
          <div className="flex items-center gap-3 sm:col-span-2">
            <button className="min-h-12 rounded-xl bg-brand px-5 font-semibold text-white" type="submit">
              Save food
            </button>
            <button className="min-h-12 rounded-xl border border-line px-5" onClick={clearForm} type="button">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {meals.map((meal) => {
          const entries = day.food.filter((entry) => entry.meal === meal.id);
          const mealCalories = entries.reduce(
            (total, entry) => total + entry.kcal * entry.servings,
            0,
          );
          return (
            <section
              aria-labelledby={`meal-${meal.id}`}
              className="rounded-3xl border border-line bg-card p-5 sm:p-6"
              key={meal.id}
            >
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold" id={`meal-${meal.id}`}>{meal.label}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {entries.length} {entries.length === 1 ? "item" : "items"}
                    {!day.profile.hideCalories ? ` · ${formatAmount(mealCalories)} kcal` : ""}
                  </p>
                </div>
                <button
                  className="min-h-11 rounded-xl border border-line px-3 text-sm font-medium"
                  onClick={() => {
                    setActionError("");
                    setActiveMeal(meal.id);
                  }}
                  type="button"
                >
                  Add food
                </button>
              </header>
              {entries.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {entries.map((entry) => (
                    <li className="flex items-start justify-between gap-3 py-3" key={entry.id}>
                      <div className="min-w-0">
                        <p className="font-medium">{entry.name}</p>
                        <p className="mt-1 text-sm text-muted">
                          {formatAmount(entry.servings)} {entry.servings === 1 ? "serving" : "servings"}
                          {!day.profile.hideCalories ? ` · ${formatAmount(entry.kcal * entry.servings)} kcal` : ""}
                        </p>
                      </div>
                      <button
                        aria-label={`Delete ${entry.name}`}
                        className="min-h-11 shrink-0 rounded-lg px-3 text-sm text-muted underline"
                        onClick={() => void deleteFood(entry)}
                        type="button"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted">No food logged for this meal yet.</p>
              )}
            </section>
          );
        })}
      </div>

      {deletedEntry ? (
        <div
          aria-live="polite"
          className="fixed bottom-36 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg lg:bottom-8"
          role="status"
        >
          <span>Food entry deleted.</span>
          <button className="min-h-11 rounded-lg px-3 font-semibold underline" onClick={() => void undoDelete()} type="button">
            Undo
          </button>
        </div>
      ) : null}
    </main>
  );
}

function NutritionCard({
  label,
  value,
  goal,
  unit,
}: {
  label: string;
  value: string;
  goal: number | null;
  unit: string;
}) {
  const numericValue = Number(value);
  const progress = goal && Number.isFinite(numericValue)
    ? Math.min(numericValue / goal, 1)
    : null;
  return (
    <article className="rounded-2xl border border-line bg-card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value}{unit ? <span className="ml-1 text-sm font-normal text-muted">{unit}</span> : null}
      </p>
      {goal !== null ? (
        <>
          <p className="mt-1 text-xs text-muted">Goal {formatAmount(goal)} {unit}</p>
          <div
            aria-label={`${label} goal progress`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round((progress ?? 0) * 100)}
            className="mt-3 h-2 overflow-hidden rounded-full bg-line"
            role="progressbar"
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${(progress ?? 0) * 100}%` }} />
          </div>
        </>
      ) : null}
    </article>
  );
}

function FoodInput({
  label,
  onChange,
  required = false,
  type = "text",
  ...inputProps
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "number" | "text";
  value: string;
  min?: string;
  step?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="min-h-12 rounded-xl border border-line bg-paper px-3 text-base"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        {...inputProps}
      />
    </label>
  );
}
