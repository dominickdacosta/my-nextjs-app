"use client";

import { useEffect, useRef, useState } from "react";
import {
  flOzToMl,
  lbToKg,
  mlToFlOz,
  type UnitSystem,
} from "@/lib/health/units";
import type { QuickLogInput } from "@/lib/health/day";
import type { TrainingType } from "@/lib/health/workouts";

const logOptions = [
  { kind: "food", label: "Food", icon: "🍽" },
  { kind: "water", label: "Water", icon: "💧" },
  { kind: "workout", label: "Workout", icon: "🏋️" },
  { kind: "cardio", label: "Walk / Run", icon: "🚶" },
  { kind: "weight", label: "Weight", icon: "⚖️" },
  { kind: "sleep", label: "Sleep", icon: "😴" },
  { kind: "mood", label: "Mood", icon: "🙂" },
  { kind: "vitals", label: "Vitals", icon: "❤️" },
  { kind: "meds", label: "Meds", icon: "💊" },
] as const;

type LogKind = (typeof logOptions)[number]["kind"];
type SaveLog = (input: QuickLogInput) => Promise<void>;
type QuickLogDraft =
  | { kind: "water"; amountMl: number }
  | { kind: "weight"; weightKg: number }
  | { kind: "checkin"; mood?: number; energy?: number };

async function getLogDate(date: string | null): Promise<string> {
  if (date) return date;
  const response = await fetch("/api/day");
  if (!response.ok) throw new Error("Could not load today's date.");
  const result = (await response.json()) as { date: string };
  return result.date;
}

export default function QuickLogSheet({
  date,
  initialKind,
  onFoodClick,
  onTrainClick,
  onClose,
  onSubmit,
  open,
  unitSystem,
}: {
  date: string | null;
  initialKind: "weight" | "water" | "mood" | null;
  onFoodClick: () => void;
  onTrainClick: (type: TrainingType) => void;
  onClose: () => void;
  onSubmit: SaveLog;
  open: boolean;
  unitSystem: UnitSystem;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<LogKind | null>(null);
  const [waterAmountMl, setWaterAmountMl] = useState(250);
  const [waterInput, setWaterInput] = useState("250");
  const [weightInput, setWeightInput] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setKind(null);
      setError("");
      return;
    }
    setKind(initialKind);
    if (initialKind === "water") {
      setWaterAmountMl(250);
      setWaterInput(unitSystem === "metric" ? "250" : mlToFlOz(250).toFixed(1));
    }
    if (initialKind === "weight") setWeightInput("");
    if (initialKind === "mood") {
      setMood(null);
      setEnergy(null);
    }
  }, [initialKind, open, unitSystem]);

  async function save(input: QuickLogDraft) {
    setSaving(true);
    setError("");
    try {
      await onSubmit({ ...input, loggedOn: await getLogDate(date) });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save this log.",
      );
    } finally {
      setSaving(false);
    }
  }

  function chooseKind(nextKind: LogKind) {
    if (nextKind === "food") {
      onFoodClick();
      return;
    }
    if (nextKind === "workout" || nextKind === "cardio") {
      onTrainClick(nextKind === "workout" ? "strength" : "cardio");
      return;
    }
    setKind(nextKind);
    setError("");
    if (nextKind === "water") {
      setWaterAmountMl(250);
      setWaterInput(
        unitSystem === "metric" ? "250" : mlToFlOz(250).toFixed(1),
      );
    }
    if (nextKind === "weight") setWeightInput("");
    if (nextKind === "mood") {
      setMood(null);
      setEnergy(null);
    }
  }

  return (
    <dialog
      aria-labelledby="quick-log-title"
      className="fixed inset-0 m-0 max-h-full w-full max-w-none overflow-y-auto bg-transparent p-0 backdrop:bg-black/40"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClose={onClose}
      onCancel={onClose}
      ref={dialogRef}
    >
      <div className="ml-auto flex min-h-full w-full max-w-xl flex-col bg-paper p-5 shadow-2xl sm:my-8 sm:min-h-0 sm:rounded-3xl sm:p-7">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{date ?? "Today"}</p>
            <h2 className="mt-1 text-2xl font-semibold" id="quick-log-title">
              {kind ? logOptions.find((option) => option.kind === kind)?.label : "Quick log"}
            </h2>
          </div>
          <button
            aria-label="Close quick log"
            className="grid size-11 place-items-center rounded-full border border-line text-xl"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        {!kind ? (
          <div className="mt-7 grid grid-cols-3 gap-3">
            {logOptions.map((option) => (
              <button
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-card text-sm font-medium"
                key={option.kind}
                onClick={() => chooseKind(option.kind)}
                type="button"
              >
                <span aria-hidden="true" className="text-2xl">
                  {option.icon}
                </span>
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        {kind === "water" ? (
          <form
            className="mt-7 grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              const amountMl =
                unitSystem === "metric"
                  ? waterAmountMl
                  : Math.round(flOzToMl(Number(waterInput)));
              void save({ kind: "water", amountMl });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              {[250, 500].map((amount) => (
                <button
                  aria-pressed={waterAmountMl === amount}
                  className={`min-h-12 rounded-xl border px-4 font-medium ${
                    waterAmountMl === amount ? "border-brand bg-brand/10 text-brand" : "border-line"
                  }`}
                  key={amount}
                  onClick={() => {
                    setWaterAmountMl(amount);
                    setWaterInput(
                      unitSystem === "metric"
                        ? String(amount)
                        : mlToFlOz(amount).toFixed(1),
                    );
                  }}
                  type="button"
                >
                  +{unitSystem === "metric" ? `${amount} ml` : `${mlToFlOz(amount).toFixed(1)} fl oz`}
                </button>
              ))}
            </div>
            <label className="grid gap-2 text-sm font-medium">
              Amount ({unitSystem === "metric" ? "ml" : "fl oz"})
              <input
                className="min-h-12 rounded-xl border border-line bg-card px-3 text-lg"
                inputMode="decimal"
                min="1"
                onChange={(event) => {
                  setWaterInput(event.target.value);
                  setWaterAmountMl(
                    unitSystem === "metric"
                      ? Number(event.target.value)
                      : Math.round(flOzToMl(Number(event.target.value))),
                  );
                }}
                required
                step="any"
                type="number"
                value={waterInput}
              />
            </label>
            <button
              className="min-h-12 rounded-xl bg-brand px-5 font-semibold text-white"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving..." : "Add water"}
            </button>
          </form>
        ) : null}

        {kind === "weight" ? (
          <form
            className="mt-7 grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              const weightKg =
                unitSystem === "metric"
                  ? Number(weightInput)
                  : lbToKg(Number(weightInput));
              void save({ kind: "weight", weightKg });
            }}
          >
            <label className="grid gap-2 text-sm font-medium">
              Body weight ({unitSystem === "metric" ? "kg" : "lb"})
              <input
                autoFocus
                className="min-h-14 rounded-xl border border-line bg-card px-4 text-2xl tabular-nums"
                inputMode="decimal"
                min="1"
                onChange={(event) => setWeightInput(event.target.value)}
                required
                step="0.1"
                type="number"
                value={weightInput}
              />
            </label>
            <button
              className="min-h-12 rounded-xl bg-brand px-5 font-semibold text-white"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving..." : "Save weight"}
            </button>
          </form>
        ) : null}

        {kind === "mood" ? (
          <form
            className="mt-7 grid gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (mood === null && energy === null) {
                setError("Choose a mood or energy level.");
                return;
              }
              void save({
                kind: "checkin",
                ...(mood !== null && { mood }),
                ...(energy !== null && { energy }),
              });
            }}
          >
            <RatingPicker
              label="Mood"
              onChange={setMood}
              selected={mood}
              values={["😞", "🙁", "😐", "🙂", "😄"]}
            />
            <RatingPicker
              label="Energy"
              onChange={setEnergy}
              selected={energy}
              values={["🪫", "😴", "😶", "⚡", "✨"]}
            />
            <button
              className="min-h-12 rounded-xl bg-brand px-5 font-semibold text-white"
              disabled={saving || (mood === null && energy === null)}
              type="submit"
            >
              {saving ? "Saving..." : "Save check-in"}
            </button>
          </form>
        ) : null}

        {kind && !["water", "weight", "mood"].includes(kind) ? (
          <div className="mt-7 rounded-2xl border border-line bg-card p-5 text-sm text-muted">
            This quick log is coming soon. Your other daily logs are ready to use.
          </div>
        ) : null}

        {kind ? (
          <button
            className="mt-4 min-h-11 self-start px-3 text-sm font-medium text-muted"
            onClick={() => setKind(null)}
            type="button"
          >
            ← All log types
          </button>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </dialog>
  );
}

function RatingPicker({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: string[];
  selected: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-5 gap-2">
        {values.map((icon, index) => {
          const value = index + 1;
          return (
            <button
              aria-label={`${label} ${value} of 5`}
              aria-pressed={selected === value}
              className={`min-h-12 rounded-xl border text-2xl ${
                selected === value ? "border-brand bg-brand/10" : "border-line bg-card"
              }`}
              key={value}
              onClick={() => onChange(value)}
              type="button"
            >
              {icon}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
