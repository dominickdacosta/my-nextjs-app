"use client";

import { useEffect, useState, type FormEvent } from "react";
import useSWR, { useSWRConfig } from "swr";
import { DateSwitcher } from "@/components/today-dashboard";
import { useAppContext } from "@/components/app-shell";
import RemindersPanel from "@/components/reminders-panel";
import type { DayPayload } from "@/lib/health/day";
import { todayFor } from "@/lib/health/dates";
import {
  connectHealthConnectSteps,
  getHealthConnectLastSync,
  healthConnectAvailable,
  healthConnectStateEvent,
  isHealthConnectConnected,
  syncHealthConnectSteps,
} from "@/lib/health/health-connect";
import {
  cmToInches,
  formatWeight,
  inchesToCm,
  lbToKg,
} from "@/lib/health/units";
import { estimateCaloriesFromSteps } from "@/lib/health/energy";

type Panel = "body" | "sleep" | "vitals" | "activity";
type QuickKind = "sleep" | "vitals" | null;
type VitalKind =
  | "blood_pressure"
  | "heart_rate"
  | "blood_glucose"
  | "oxygen_saturation"
  | "temperature";
const panels: Array<{ id: Panel; label: string; icon: string }> = [
  { id: "body", label: "Body", icon: "⚖️" },
  { id: "sleep", label: "Sleep", icon: "😴" },
  { id: "vitals", label: "Vitals", icon: "❤️" },
  { id: "activity", label: "Steps", icon: "👟" },
];

const vitalUnits: Record<VitalKind, string> = {
  blood_pressure: "mmHg",
  heart_rate: "bpm",
  blood_glucose: "mg/dL",
  oxygen_saturation: "%",
  temperature: "°C",
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load your health data.");
  return (await response.json()) as T;
}

function dayKey(date: string | null): string {
  return date ? `/api/day?date=${encodeURIComponent(date)}` : "/api/day";
}

function optionalNumber(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

async function postJson<T>(url: string, value: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) {
    const result = (await response.json()) as { error?: string };
    throw new Error(result.error ?? "Could not save this health log.");
  }
  return (await response.json()) as T;
}

export default function MoreHealthPage() {
  const {
    selectedDate,
    setSelectedDate,
    moreQuickKind,
    moreQuickOpen,
    setMoreQuickOpen,
    userId,
  } = useAppContext();
  const { mutate: mutateCache } = useSWRConfig();
  const { data: day, error: dayError } = useSWR<DayPayload>(
    dayKey(selectedDate),
    fetchJson,
  );
  const [activePanel, setActivePanel] = useState<Panel | null>(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [healthConnectAvailableOnDevice, setHealthConnectAvailableOnDevice] =
    useState(false);
  const [healthConnectConnected, setHealthConnectConnected] = useState(false);
  const [healthConnectBusy, setHealthConnectBusy] = useState(false);
  const [healthConnectLastSync, setHealthConnectLastSync] = useState<string | null>(
    null,
  );
  const [healthConnectError, setHealthConnectError] = useState("");

  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [waist, setWaist] = useState("");
  const [hip, setHip] = useState("");

  const [sleepDuration, setSleepDuration] = useState("");
  const [sleepQuality, setSleepQuality] = useState("");
  const [awakenings, setAwakenings] = useState("");
  const [sleepNotes, setSleepNotes] = useState("");

  const [vitalKind, setVitalKind] = useState<VitalKind>("blood_pressure");
  const [vitalPrimary, setVitalPrimary] = useState("");
  const [vitalSecondary, setVitalSecondary] = useState("");
  const [vitalUnit, setVitalUnit] = useState("mmHg");
  const [vitalContext, setVitalContext] = useState("");

  useEffect(() => {
    let active = true;
    const updateConnectionState = () => {
      if (!userId) {
        setHealthConnectConnected(false);
        setHealthConnectLastSync(null);
        return;
      }
      setHealthConnectConnected(isHealthConnectConnected(userId));
      setHealthConnectLastSync(getHealthConnectLastSync(userId));
    };

    updateConnectionState();
    window.addEventListener(healthConnectStateEvent, updateConnectionState);
    void healthConnectAvailable()
      .then((available) => {
        if (active) setHealthConnectAvailableOnDevice(available);
      })
      .catch(() => {
        if (active) setHealthConnectError("Could not check Health Connect availability.");
      });

    return () => {
      active = false;
      window.removeEventListener(healthConnectStateEvent, updateConnectionState);
    };
  }, [userId]);

  useEffect(() => {
    if (!moreQuickOpen) return;
    const panel: Record<Exclude<QuickKind, null>, Panel> = {
      sleep: "sleep",
      vitals: "vitals",
    };
    if (moreQuickKind) setActivePanel(panel[moreQuickKind]);
    setMoreQuickOpen(false);
  }, [moreQuickKind, moreQuickOpen, setMoreQuickOpen]);

  if (!day) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-36 pt-8 sm:px-8 lg:pb-12">
        <p aria-live="polite" className="rounded-2xl bg-card p-5 text-muted" role="status">
          {dayError ? "Your health log could not be loaded." : "Loading your health data..."}
        </p>
        {dayError ? <p className="mt-3 text-sm text-red-700" role="alert">{dayError.message}</p> : null}
      </main>
    );
  }

  const dayData = day;
  const unitSystem = day.profile.unitSystem;
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day.date}T12:00:00.000Z`));
  const today = selectedDate === null;

  async function saveAndRefresh(url: string, payload: unknown) {
    setActionError("");
    setNotice("");
    try {
      await postJson(url, payload);
      setNotice("Saved.");
      try {
        await mutateCache(dayKey(selectedDate));
      } catch {
        setActionError("Your log was saved, but the summary could not refresh.");
      }
    } catch (saveError) {
      setActionError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this health log.",
      );
    }
  }

  async function connectToHealthConnect() {
    if (!userId) {
      setHealthConnectError("Your account is not ready to connect Health Connect.");
      return;
    }
    setHealthConnectBusy(true);
    setHealthConnectError("");
    try {
      await connectHealthConnectSteps(userId);
      setHealthConnectConnected(true);
      const result = await syncHealthConnectSteps(dayData.profile.timezone, userId);
      setHealthConnectLastSync(result.lastSyncedAt);
      await mutateCache("/api/day");
      setNotice(`Synced ${result.steps.toLocaleString()} steps from Health Connect.`);
    } catch (error) {
      setHealthConnectError(
        error instanceof Error
          ? error.message
          : "Could not connect to Health Connect.",
      );
    } finally {
      setHealthConnectBusy(false);
    }
  }

  async function refreshHealthConnectSteps() {
    if (!userId) {
      setHealthConnectError("Your account is not ready to sync steps.");
      return;
    }
    setHealthConnectBusy(true);
    setHealthConnectError("");
    try {
      const result = await syncHealthConnectSteps(dayData.profile.timezone, userId);
      setHealthConnectLastSync(result.lastSyncedAt);
      await mutateCache("/api/day");
      setNotice(`Synced ${result.steps.toLocaleString()} steps from Health Connect.`);
    } catch (error) {
      setHealthConnectError(
        error instanceof Error
          ? error.message
          : "Could not refresh Health Connect steps.",
      );
    } finally {
      setHealthConnectBusy(false);
    }
  }

  function submitBody(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const convert = (value: string) => {
      const number = optionalNumber(value);
      if (number === null) return null;
      return unitSystem === "metric" ? number : inchesToCm(number);
    };
    void saveAndRefresh("/api/body-measurements", {
      loggedOn: dayData.date,
      weightKg:
        optionalNumber(weight) === null
          ? null
          : unitSystem === "metric"
            ? Number(weight)
            : lbToKg(Number(weight)),
      bodyFatPct: optionalNumber(bodyFat),
      waistCm: convert(waist),
      hipCm: convert(hip),
    });
  }

  function submitSleep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveAndRefresh("/api/sleep-entries", {
      loggedOn: dayData.date,
      sleepDate: dayData.date,
      durationMin: optionalNumber(sleepDuration),
      quality: optionalNumber(sleepQuality),
      awakenings: optionalNumber(awakenings),
      notes: sleepNotes.trim() || null,
    });
  }

  function changeVitalKind(value: VitalKind) {
    setVitalKind(value);
    setVitalUnit(vitalUnits[value]);
    setVitalPrimary("");
    setVitalSecondary("");
  }

  function submitVital(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveAndRefresh("/api/vitals", {
      loggedOn: dayData.date,
      kind: vitalKind,
      valuePrimary: Number(vitalPrimary),
      valueSecondary:
        vitalKind === "blood_pressure" ? Number(vitalSecondary) : null,
      unit: vitalUnit,
      context: vitalContext.trim() || null,
      measuredAt: new Date().toISOString(),
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-36 pt-7 sm:px-8 sm:pt-10 lg:pb-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-medium text-brand">More health logs</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">More</h1>
          <p className="mt-2 text-sm text-muted">Body measurements, sleep, vitals, and steps.</p>
        </div>
        <DateSwitcher
          date={day.date}
          dateLabel={dateLabel}
          disabledNext={today || day.date >= todayFor(day.profile.timezone)}
          onChange={setSelectedDate}
          onToday={() => setSelectedDate(null)}
          viewingToday={today}
        />
      </header>

      {actionError ? <p className="mb-4 text-sm text-red-700" role="alert">{actionError}</p> : null}
      {notice ? <p aria-live="polite" className="mb-4 text-sm text-brand" role="status">{notice}</p> : null}

      <section aria-label="Health log types" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {panels.map((panel) => (
          <button
            aria-pressed={activePanel === panel.id}
            className={`min-h-24 rounded-2xl border p-4 text-left ${
              activePanel === panel.id ? "border-brand bg-brand/10" : "border-line bg-card"
            }`}
            key={panel.id}
            onClick={() => {
              setActivePanel(panel.id);
              setActionError("");
            }}
            type="button"
          >
            <span aria-hidden="true" className="text-2xl">{panel.icon}</span>
            <span className="mt-2 block font-medium">{panel.label}</span>
          </button>
        ))}
      </section>

      {activePanel === "body" ? (
        <section className="mt-5 rounded-3xl border border-line bg-card p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Body measurements</h2>
          <p className="mt-1 text-sm text-muted">Values are stored in metric units and converted for display.</p>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submitBody}>
            <HealthInput label={`Weight (${unitSystem === "metric" ? "kg" : "lb"})`} min="1" onChange={setWeight} step="0.1" type="number" value={weight} />
            <HealthInput label="Body fat (%)" min="0" max="100" onChange={setBodyFat} step="0.1" type="number" value={bodyFat} />
            <HealthInput label={`Waist (${unitSystem === "metric" ? "cm" : "in"})`} min="1" onChange={setWaist} step="0.1" type="number" value={waist} />
            <HealthInput label={`Hips (${unitSystem === "metric" ? "cm" : "in"})`} min="1" onChange={setHip} step="0.1" type="number" value={hip} />
            <button className="min-h-12 rounded-xl bg-brand px-5 font-semibold text-white sm:col-span-2 sm:justify-self-start" type="submit">Save measurements</button>
          </form>
          <ul className="mt-5 divide-y divide-line">
            {day.measurements.map((entry) => (
              <li className="py-3 text-sm" key={entry.id}>
                {[
                  entry.weightKg !== null
                    ? `Weight ${formatWeight(entry.weightKg, unitSystem)}`
                    : null,
                  entry.bodyFatPct != null ? `Body fat ${entry.bodyFatPct}%` : null,
                  entry.waistCm != null
                    ? `Waist ${unitSystem === "metric" ? `${entry.waistCm} cm` : `${cmToInches(entry.waistCm).toFixed(1)} in`}`
                    : null,
                  entry.hipCm != null
                    ? `Hips ${unitSystem === "metric" ? `${entry.hipCm} cm` : `${cmToInches(entry.hipCm).toFixed(1)} in`}`
                    : null,
                ].filter(Boolean).join(" · ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activePanel === "sleep" ? (
        <section className="mt-5 rounded-3xl border border-line bg-card p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Sleep</h2>
          <p className="mt-1 text-sm text-muted">Log the sleep period that ended on {dateLabel}.</p>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submitSleep}>
            <HealthInput label="Duration (minutes)" min="1" max="1440" onChange={setSleepDuration} step="1" type="number" value={sleepDuration} />
            <label className="grid gap-2 text-sm font-medium">
              Sleep quality
              <select className="min-h-12 rounded-xl border border-line bg-paper px-3" onChange={(event) => setSleepQuality(event.target.value)} value={sleepQuality}>
                <option value="">Not rated</option>
                {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
              </select>
            </label>
            <HealthInput label="Times woken" min="0" max="100" onChange={setAwakenings} step="1" type="number" value={awakenings} />
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">
              Notes
              <textarea className="min-h-20 rounded-xl border border-line bg-paper p-3" maxLength={1000} onChange={(event) => setSleepNotes(event.target.value)} value={sleepNotes} />
            </label>
            <button className="min-h-12 rounded-xl bg-brand px-5 font-semibold text-white sm:col-span-2 sm:justify-self-start" type="submit">Save sleep</button>
          </form>
          {day.sleep ? (
            <p className="mt-4 text-sm text-muted">
              Latest: {day.sleep.durationMin ? `${(day.sleep.durationMin / 60).toFixed(1)} hours` : "duration not set"}
              {day.sleep.quality ? ` · quality ${day.sleep.quality}/5` : ""}
            </p>
          ) : null}
        </section>
      ) : null}

      {activePanel === "vitals" ? (
        <section className="mt-5 rounded-3xl border border-line bg-card p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Vitals</h2>
          <p className="mt-1 text-sm text-muted">Personal records only; values are not interpreted as medical advice.</p>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submitVital}>
            <label className="grid gap-2 text-sm font-medium">
              Measurement
              <select className="min-h-12 rounded-xl border border-line bg-paper px-3" onChange={(event) => changeVitalKind(event.target.value as VitalKind)} value={vitalKind}>
                <option value="blood_pressure">Blood pressure</option>
                <option value="heart_rate">Heart rate</option>
                <option value="blood_glucose">Blood glucose</option>
                <option value="oxygen_saturation">Oxygen saturation</option>
                <option value="temperature">Temperature</option>
              </select>
            </label>
            <HealthInput label={`${vitalKind === "blood_pressure" ? "Systolic" : "Value"} (${vitalUnit})`} min="0.1" onChange={setVitalPrimary} step="any" type="number" value={vitalPrimary} />
            {vitalKind === "blood_pressure" ? (
              <HealthInput label="Diastolic (mmHg)" min="0.1" onChange={setVitalSecondary} step="any" type="number" value={vitalSecondary} />
            ) : null}
            {vitalKind === "blood_glucose" ? (
              <label className="grid gap-2 text-sm font-medium">
                Unit
                <select className="min-h-12 rounded-xl border border-line bg-paper px-3" onChange={(event) => setVitalUnit(event.target.value)} value={vitalUnit}>
                  <option value="mg/dL">mg/dL</option>
                  <option value="mmol/L">mmol/L</option>
                </select>
              </label>
            ) : null}
            {vitalKind === "temperature" ? (
              <label className="grid gap-2 text-sm font-medium">
                Unit
                <select className="min-h-12 rounded-xl border border-line bg-paper px-3" onChange={(event) => setVitalUnit(event.target.value)} value={vitalUnit}>
                  <option value="°C">°C</option>
                  <option value="°F">°F</option>
                </select>
              </label>
            ) : null}
            <HealthInput label="Context (optional)" onChange={setVitalContext} value={vitalContext} />
            <button className="min-h-12 rounded-xl bg-brand px-5 font-semibold text-white sm:col-span-2 sm:justify-self-start" type="submit">Save vital</button>
          </form>
          <ul className="mt-5 divide-y divide-line">
            {day.vitals.map((entry) => (
              <li className="py-3 text-sm" key={entry.id}>
                {entry.kind.replaceAll("_", " ")}: {entry.valuePrimary}
                {entry.valueSecondary !== null ? ` / ${entry.valueSecondary}` : ""} {entry.unit}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activePanel === "activity" ? (
        <section className="mt-5 rounded-3xl border border-line bg-card p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Steps</h2>
          <p className="mt-1 text-sm text-muted">Your steps sync from Google Health Connect. No manual activity entry is needed.</p>
          <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
            <h3 className="font-semibold">Google Health Connect</h3>
            <p className="mt-1 text-sm text-muted">
              Steps for {day.date}:{" "}
              <span className="font-semibold text-ink">
                {day.activity?.source === "health-connect"
                  ? day.activity.steps.toLocaleString()
                  : "Not synced"}
              </span>
            </p>
            {day.activity?.source === "health-connect" ? (
              <p className="mt-2 text-sm text-muted">
                Estimated calories burned:{" "}
                {day.profile.hideCalories
                  ? "Hidden in calorie settings"
                  : `~${estimateCaloriesFromSteps(day.activity.steps)} kcal`}
              </p>
            ) : null}
            {healthConnectAvailableOnDevice ? (
              <>
                <p className="mt-1 text-sm text-muted">
                  {healthConnectConnected ? "Connected" : "Not connected"}
                  {healthConnectLastSync
                    ? ` · Last synced ${new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(healthConnectLastSync))}`
                    : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {healthConnectConnected ? (
                    <>
                      <button
                        className="min-h-11 rounded-xl bg-brand px-4 font-medium text-white disabled:opacity-60"
                        disabled={healthConnectBusy || !userId}
                        onClick={() => void refreshHealthConnectSteps()}
                        type="button"
                      >
                        {healthConnectBusy ? "Syncing..." : "Refresh steps"}
                      </button>
                      <button
                        className="min-h-11 rounded-xl border border-line px-4 font-medium disabled:opacity-60"
                        disabled={healthConnectBusy || !userId}
                        onClick={() => void connectToHealthConnect()}
                        type="button"
                      >
                        Reconnect
                      </button>
                    </>
                  ) : (
                    <button
                      className="min-h-11 rounded-xl bg-brand px-4 font-medium text-white disabled:opacity-60"
                      disabled={healthConnectBusy || !userId}
                      onClick={() => void connectToHealthConnect()}
                      type="button"
                    >
                      {healthConnectBusy ? "Connecting..." : "Connect Health Connect"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">
                Connect Health Connect in the Vitals Android app to sync steps.
                This page displays the latest synced total.
              </p>
            )}
            {healthConnectError ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {healthConnectError}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <RemindersPanel />
    </main>
  );
}

function HealthInput({
  label,
  onChange,
  type = "text",
  required = false,
  ...props
}: {
  label: string;
  onChange: (value: string) => void;
  type?: "number" | "text" | "time";
  required?: boolean;
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
        required={required}
        type={type}
        {...props}
      />
    </label>
  );
}
