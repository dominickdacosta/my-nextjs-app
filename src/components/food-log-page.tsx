"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import useSWR from "swr";
import { DateSwitcher } from "@/components/today-dashboard";
import { useAppContext } from "@/components/app-shell";
import type { DayFoodEntry, DayPayload } from "@/lib/health/day";
import type { FoodSearchResult } from "@/lib/health/food-search";
import { todayFor } from "@/lib/health/dates";
import {
  totalFoodNutrients,
  type FoodParseResult,
  type ParsedFoodIngredient,
} from "@/lib/health/food-parser";

type SavedMeal = {
  id: string;
  name: string;
  items: Array<{
    name: string;
    servings: number;
    kcal: number;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    fiberG: number | null;
    nutritionSource: DayFoodEntry["nutritionSource"];
  }>;
};

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

async function fetchSavedMeals(url: string): Promise<SavedMeal[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load your favorite meals.");
  return (await response.json()) as SavedMeal[];
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
  const { data: savedMeals, mutate: mutateSavedMeals } = useSWR<SavedMeal[]>(
    "/api/saved-meals",
    fetchSavedMeals,
  );
  const [activeMeal, setActiveMeal] = useState<
    DayFoodEntry["meal"] | null
  >(null);
  const [formHighlighted, setFormHighlighted] = useState(false);
  const [formFocusRequest, setFormFocusRequest] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [servings, setServings] = useState("1");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [nutritionSource, setNutritionSource] = useState<
    DayFoodEntry["nutritionSource"]
  >("manual");
  const [selectedFoodSource, setSelectedFoodSource] = useState<
    "fdc" | "open-food-facts" | null
  >(null);
  const [entryNotes, setEntryNotes] = useState("");
  const [foodDescription, setFoodDescription] = useState("");
  const [parsedIngredients, setParsedIngredients] = useState<
    ParsedFoodIngredient[] | null
  >(null);
  const [parsingFood, setParsingFood] = useState(false);
  const [parseError, setParseError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchWarning, setSearchWarning] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [deletedEntry, setDeletedEntry] = useState<DayFoodEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<DayFoodEntry | null>(null);
  const [savedMealCategory, setSavedMealCategory] =
    useState<DayFoodEntry["meal"]>("snack");

  useEffect(() => {
    if (!deletedEntry) return;
    const timeout = window.setTimeout(() => setDeletedEntry(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [deletedEntry]);

  useEffect(() => {
    setDeletedEntry(null);
  }, [data?.date]);

  useEffect(() => {
    const requestedMeal = new URLSearchParams(window.location.search).get("meal");
    const meal = meals.find((item) => item.id === requestedMeal);
    if (meal) setActiveMeal(meal.id);
  }, []);

  useEffect(() => {
    if (!activeMeal || !formRef.current) return;
    setFormHighlighted(true);
    formRef.current.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
    const timeout = window.setTimeout(() => setFormHighlighted(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [activeMeal, formFocusRequest]);

  useEffect(() => {
    const query = searchText.trim();
    if (!activeMeal || query.length < 2) {
      setSearchResults([]);
      setSearchError("");
      setSearchWarning("");
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError("");
      setSearchWarning("");
      void fetch(`/api/foods/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const result = (await response.json()) as { error?: string };
            throw new Error(result.error ?? "Could not search foods.");
          }
          return (await response.json()) as {
            results: FoodSearchResult[];
            warning?: string;
          };
        })
        .then((result) => {
          setSearchResults(result.results);
          setSearchWarning(result.warning ?? "");
        })
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
    setNutritionSource("manual");
    setSelectedFoodSource(null);
    setEntryNotes("");
    setFoodDescription("");
    setParsedIngredients(null);
    setParsingFood(false);
    setParseError("");
    setEditingEntry(null);
    setSearchText("");
    setSearchResults([]);
    setActiveMeal(null);
  }

  function focusMealForm(meal: DayFoodEntry["meal"]) {
    setActiveMeal(meal);
    setFormFocusRequest((request) => request + 1);
  }

  function chooseSearchResult(result: FoodSearchResult) {
    setName(result.name);
    setServings("1");
    setCalories(result.kcal === null ? "" : String(result.kcal));
    setProtein(result.proteinG === null ? "" : String(result.proteinG));
    setCarbs(result.carbsG === null ? "" : String(result.carbsG));
    setFat(result.fatG === null ? "" : String(result.fatG));
    setFiber(result.fiberG === null ? "" : String(result.fiberG));
    setNutritionSource(result.nutritionSource);
    setSelectedFoodSource(
      result.source === "fdc" || result.source === "open-food-facts"
        ? result.source
        : null,
    );
    setEntryNotes("");
    setParsedIngredients(null);
    setSearchText("");
    setSearchResults([]);
  }

  function editFood(entry: DayFoodEntry) {
    focusMealForm(entry.meal);
    setEditingEntry(entry);
    setName(entry.name);
    setServings(String(entry.servings));
    setCalories(String(entry.kcal));
    setProtein(entry.proteinG === null ? "" : String(entry.proteinG));
    setCarbs(entry.carbsG === null ? "" : String(entry.carbsG));
    setFat(entry.fatG === null ? "" : String(entry.fatG));
    setFiber(entry.fiberG === null ? "" : String(entry.fiberG));
    setNutritionSource(entry.nutritionSource);
    setSelectedFoodSource(null);
    setEntryNotes(entry.notes ?? "");
    setFoodDescription(entry.name);
    setParsedIngredients(null);
    setActionError("");
  }

  function applyParsedIngredients(ingredients: ParsedFoodIngredient[]) {
    const totals = totalFoodNutrients(ingredients);
    setParsedIngredients(ingredients);
    setCalories(String(Math.round(totals.kcal)));
    setProtein(String(Number(totals.proteinG.toFixed(1))));
    setCarbs(String(Number(totals.carbsG.toFixed(1))));
    setFat(String(Number(totals.fatG.toFixed(1))));
    setFiber(String(Number(totals.fiberG.toFixed(1))));
  }

  async function estimateFood() {
    setParseError("");
    setParsingFood(true);
    try {
      const response = await fetch("/api/foods/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: foodDescription }),
      });
      const result = (await response.json()) as
        | (FoodParseResult & { totals: ReturnType<typeof totalFoodNutrients> })
        | { error?: string; unsupported?: string[] };
      if (!response.ok) {
        throw new Error(
          "error" in result
            ? result.error ?? "Could not estimate this meal."
            : "Could not estimate this meal.",
        );
      }
      if (!("totals" in result)) {
        throw new Error("The estimate response was incomplete.");
      }
      setName(foodDescription.trim());
      setServings("1");
      setNutritionSource("estimated");
      setSelectedFoodSource(null);
      setEntryNotes(
        `Estimated ingredients: ${result.ingredients
          .map((ingredient) => `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`)
          .join("; ")}${result.assumptions.length ? `. ${result.assumptions.join(" ")}` : ""}`,
      );
      applyParsedIngredients(result.ingredients);
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : "Could not estimate this meal.",
      );
    } finally {
      setParsingFood(false);
    }
  }

  function adjustIngredient(index: number, quantity: number) {
    if (!parsedIngredients || !Number.isFinite(quantity) || quantity <= 0) return;
    const updated = parsedIngredients.map((ingredient, ingredientIndex) =>
      ingredientIndex === index ? { ...ingredient, quantity } : ingredient,
    );
    applyParsedIngredients(updated);
    setNutritionSource("estimated");
    setEntryNotes(
      `Estimated ingredients: ${updated
        .map((ingredient) => `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`)
        .join("; ")}`,
    );
  }

  function removeIngredient(index: number) {
    if (!parsedIngredients) return;
    const updated = parsedIngredients.filter(
      (_ingredient, ingredientIndex) => ingredientIndex !== index,
    );
    if (!updated.length) {
      setParsedIngredients(null);
      setNutritionSource("manual");
      setEntryNotes("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
      setFiber("");
      return;
    }
    applyParsedIngredients(updated);
    setEntryNotes(
      `Estimated ingredients: ${updated
        .map((ingredient) => `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`)
        .join("; ")}`,
    );
  }

  function editNutrition(setter: (value: string) => void, value: string) {
    setter(value);
    setNutritionSource("manual");
    setSelectedFoodSource(null);
    setParsedIngredients(null);
    setEntryNotes("");
  }

  async function addFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeMeal) return;
    setActionError("");
    setNotice("");
    const numberOrNull = (value: string) =>
      value.trim() ? Number(value) : null;
    try {
      const response = await fetch(
        editingEntry
          ? `/api/food-entries/${encodeURIComponent(editingEntry.id)}`
          : "/api/food-entries",
        {
        method: editingEntry ? "PUT" : "POST",
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
          nutritionSource,
          notes: entryNotes || null,
        }),
        },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not save this food entry.");
      }
      clearForm();
      setNotice(editingEntry ? "Food entry updated." : "Food entry saved.");
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

  async function repeatFood(entry: DayFoodEntry) {
    setActionError("");
    try {
      const response = await fetch("/api/food-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loggedOn: day.date,
          meal: entry.meal,
          name: entry.name,
          servings: entry.servings,
          kcal: entry.kcal,
          proteinG: entry.proteinG,
          carbsG: entry.carbsG,
          fatG: entry.fatG,
          fiberG: entry.fiberG,
          nutritionSource: entry.nutritionSource,
          notes: entry.notes,
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not repeat this food entry.");
      }
      await mutate();
    } catch (repeatError) {
      setActionError(
        repeatError instanceof Error
          ? repeatError.message
          : "Could not repeat this food entry.",
      );
    }
  }

  async function saveFavorite(meal: (typeof meals)[number], entries: DayFoodEntry[]) {
    setActionError("");
    try {
      const response = await fetch("/api/saved-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${meal.label} favorite`,
          items: entries.map((entry) => ({
            name: entry.name,
            servings: entry.servings,
            kcal: entry.kcal,
            proteinG: entry.proteinG,
            carbsG: entry.carbsG,
            fatG: entry.fatG,
            fiberG: entry.fiberG,
            nutritionSource: entry.nutritionSource,
          })),
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not save this favorite meal.");
      }
      await mutateSavedMeals();
      setNotice("Favorite meal saved.");
    } catch (saveError) {
      setActionError(
        saveError instanceof Error ? saveError.message : "Could not save this favorite meal.",
      );
    }
  }

  async function logFavorite(savedMeal: SavedMeal) {
    setActionError("");
    try {
      const response = await fetch(
        `/api/saved-meals/${encodeURIComponent(savedMeal.id)}/log`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loggedOn: day.date, meal: savedMealCategory }),
        },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not add this favorite meal.");
      }
      await mutate();
      setNotice(`${savedMeal.name} added to ${savedMealCategory}.`);
    } catch (logError) {
      setActionError(
        logError instanceof Error ? logError.message : "Could not add this favorite meal.",
      );
    }
  }

  async function deleteFavorite(savedMeal: SavedMeal) {
    setActionError("");
    try {
      const response = await fetch(
        `/api/saved-meals/${encodeURIComponent(savedMeal.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not remove this favorite.");
      }
      await mutateSavedMeals();
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error ? deleteError.message : "Could not remove this favorite.",
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

      {savedMeals?.length ? (
        <section aria-label="Favorite meals" className="mt-5 rounded-3xl border border-line bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Favorite meals</h2>
              <p className="mt-1 text-sm text-muted">Repeat a saved meal with one tap.</p>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              Add to
              <select
                className="min-h-11 rounded-xl border border-line bg-paper px-3"
                onChange={(event) => setSavedMealCategory(event.target.value as DayFoodEntry["meal"])}
                value={savedMealCategory}
              >
                {meals.map((meal) => <option key={meal.id} value={meal.id}>{meal.label}</option>)}
              </select>
            </label>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {savedMeals.map((savedMeal) => (
              <li className="flex items-center justify-between gap-3 rounded-xl bg-paper p-3" key={savedMeal.id}>
                <div className="min-w-0">
                  <p className="truncate font-medium">{savedMeal.name}</p>
                  <p className="text-xs text-muted">{savedMeal.items.length} {savedMeal.items.length === 1 ? "item" : "items"}</p>
                </div>
                <div className="flex shrink-0">
                  <button className="min-h-11 rounded-lg px-3 text-sm text-brand underline" onClick={() => void logFavorite(savedMeal)} type="button">Add</button>
                  <button aria-label={`Remove ${savedMeal.name} from favorites`} className="min-h-11 rounded-lg px-3 text-sm text-muted underline" onClick={() => void deleteFavorite(savedMeal)} type="button">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activeMeal ? (
        <form
          className={`mt-6 grid gap-4 rounded-3xl border bg-card p-5 transition-shadow sm:grid-cols-2 sm:p-7 ${
            formHighlighted
              ? "border-brand ring-2 ring-brand shadow-lg"
              : "border-line"
          }`}
          onSubmit={(event) => void addFood(event)}
          ref={formRef}
        >
          <div className="sm:col-span-2">
            <h2 className="text-xl font-semibold">
              {editingEntry ? "Edit" : "Add to"} {meals.find((meal) => meal.id === activeMeal)?.label}
            </h2>
            <p className="mt-1 text-sm text-muted">Nutrition values are per serving.</p>
          </div>
          <div className="grid gap-3 sm:col-span-2">
            <label className="grid gap-2 text-sm font-medium" htmlFor="food-description">
              What did you eat?
              <textarea
                className="min-h-24 rounded-xl border border-line bg-paper px-3 py-3 text-base"
                id="food-description"
                maxLength={300}
                onChange={(event) => {
                  setFoodDescription(event.target.value);
                  setParseError("");
                }}
                placeholder="For example: 2 chapatis and one bowl of dal"
                value={foodDescription}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="min-h-11 rounded-xl bg-brand px-4 font-medium text-white disabled:opacity-60"
                disabled={parsingFood || foodDescription.trim().length < 2}
                onClick={() => void estimateFood()}
                type="button"
              >
                {parsingFood ? "Estimating..." : "Estimate nutrition"}
              </button>
              <p className="text-sm text-muted">
                Local estimates only; review and adjust before saving.
              </p>
            </div>
            {parseError ? <p className="text-sm text-red-700" role="alert">{parseError}</p> : null}
            {parsedIngredients ? (
              <div className="rounded-2xl border border-line bg-paper p-4">
                <p className="font-medium">Estimated ingredients</p>
                <ul className="mt-2 grid gap-2">
                  {parsedIngredients.map((ingredient, index) => (
                    <li className="flex flex-wrap items-center gap-2" key={`${ingredient.name}-${index}`}>
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <span>{ingredient.name}</span>
                        <input
                          aria-label={`Quantity of ${ingredient.name}`}
                          className="min-h-11 w-24 rounded-lg border border-line bg-card px-2"
                          min="0.1"
                          onChange={(event) => adjustIngredient(index, Number(event.target.value))}
                          step="0.1"
                          type="number"
                          value={ingredient.quantity}
                        />
                        <span className="text-muted">{ingredient.unit}</span>
                      </label>
                      <button
                        aria-label={`Remove ${ingredient.name}`}
                        className="min-h-11 rounded-lg px-3 text-sm text-muted underline"
                        onClick={() => removeIngredient(index)}
                        type="button"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <details className="grid gap-4 rounded-2xl border border-line p-4 sm:col-span-2">
            <summary className="min-h-11 cursor-pointer py-2 font-medium">
              Search a food or enter nutrition manually
            </summary>
          <div className="grid gap-2 sm:col-span-2">
            <label className="text-sm font-medium" htmlFor="food-search">
              Search recent foods, Open Food Facts, and USDA
            </label>
            <p className="text-xs text-muted">
              Search terms are sent to{" "}
              <a
                className="underline"
                href="https://world.openfoodfacts.org/"
                rel="noopener noreferrer"
                target="_blank"
              >
                Open Food Facts
              </a>
              {" "}and, when configured, USDA FoodData Central.
            </p>
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
            {searchWarning ? <p className="text-sm text-muted" role="status">{searchWarning}</p> : null}
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
                          result.source === "open-food-facts"
                            ? "Open Food Facts · community data"
                            : result.source === "fdc"
                              ? "USDA FoodData Central"
                              : "Previous food",
                        ].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <FoodInput label="Food name" onChange={(value) => editNutrition(setName, value)} required value={name} />
          <FoodInput label="Servings" min="0.1" onChange={setServings} required step="0.1" type="number" value={servings} />
          {!day.profile.hideCalories ? (
            <FoodInput label="Calories (kcal)" min="0" onChange={(value) => editNutrition(setCalories, value)} step="1" type="number" value={calories} />
          ) : null}
          <FoodInput label="Protein (g)" min="0" onChange={(value) => editNutrition(setProtein, value)} step="0.1" type="number" value={protein} />
          <FoodInput label="Carbohydrates (g)" min="0" onChange={(value) => editNutrition(setCarbs, value)} step="0.1" type="number" value={carbs} />
          <FoodInput label="Fat (g)" min="0" onChange={(value) => editNutrition(setFat, value)} step="0.1" type="number" value={fat} />
          <FoodInput label="Fiber (g)" min="0" onChange={(value) => editNutrition(setFiber, value)} step="0.1" type="number" value={fiber} />
          </details>
          {parsedIngredients ? (
            <p className="text-sm text-muted sm:col-span-2">
              Estimate from a built-in food reference. Portions and preparation vary; this is not verified label data.
            </p>
          ) : nutritionSource === "verified" ? (
            <p className="text-sm text-muted sm:col-span-2">Values selected from USDA FoodData Central.</p>
          ) : selectedFoodSource === "open-food-facts" ? (
            <p className="text-sm text-muted sm:col-span-2">
              Open Food Facts values are community-contributed. Check them against the product label.
            </p>
          ) : null}
          <div className="flex items-center gap-3 sm:col-span-2">
            <button className="min-h-12 rounded-xl bg-brand px-5 font-semibold text-white" type="submit">
              {editingEntry ? "Save changes" : "Save food"}
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
                    focusMealForm(meal.id);
                  }}
                  type="button"
                >
                  Add food
                </button>
                {entries.length ? (
                  <button
                    className="min-h-11 rounded-xl border border-line px-3 text-sm font-medium"
                    onClick={() => void saveFavorite(meal, entries)}
                    type="button"
                  >
                    Save favorite
                  </button>
                ) : null}
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
                        <p className="mt-1 text-xs text-muted">
                          {entry.nutritionSource === "verified"
                            ? "USDA FoodData Central"
                            : entry.nutritionSource === "estimated"
                              ? "Estimated nutrition"
                              : "Manually entered"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end">
                        <button
                          aria-label={`Edit ${entry.name}`}
                          className="min-h-11 rounded-lg px-3 text-sm text-brand underline"
                          onClick={() => editFood(entry)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          aria-label={`Repeat ${entry.name}`}
                          className="min-h-11 rounded-lg px-3 text-sm text-brand underline"
                          onClick={() => void repeatFood(entry)}
                          type="button"
                        >
                          Repeat
                        </button>
                        <button
                          aria-label={`Delete ${entry.name}`}
                          className="min-h-11 rounded-lg px-3 text-sm text-muted underline"
                          onClick={() => void deleteFood(entry)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
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
