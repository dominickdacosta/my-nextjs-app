"use client";

import { useEffect, useRef, useState } from "react";
import type { RunRoutePoint } from "@/lib/health/workouts";
import {
  averagePaceSecPerKm,
  routeDistanceM,
  validGpsStep,
} from "@/lib/health/running";
import type { UnitSystem } from "@/lib/health/units";

type Props = {
  date: string;
  unitSystem: UnitSystem;
  weightKg: number | null;
  onSaved: () => void;
};

type TrackerState = "idle" | "running" | "paused" | "saving";

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function formatPace(secondsPerKm: number | null, unitSystem: UnitSystem): string {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm)) return "—";
  const secondsPerUnit =
    unitSystem === "metric" ? secondsPerKm : secondsPerKm * 1.609344;
  const minutes = Math.floor(secondsPerUnit / 60);
  const seconds = Math.round(secondsPerUnit % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")} / ${unitSystem === "metric" ? "km" : "mi"}`;
}

function routePath(points: RunRoutePoint[]): string {
  if (!points.length) return "";
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeRange = maxLatitude - minLatitude || 0.00001;
  const longitudeRange = maxLongitude - minLongitude || 0.00001;
  return points
    .map((point) => {
      const x = 8 + ((point.longitude - minLongitude) / longitudeRange) * 84;
      const y = 92 - ((point.latitude - minLatitude) / latitudeRange) * 84;
      return `${x},${y}`;
    })
    .join(" ");
}

export function RunRoutePreview({
  points,
  label = "Private route preview",
  compact = false,
}: {
  points: RunRoutePoint[];
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper">
      <svg
        aria-label={label}
        className={`${compact ? "h-32" : "h-52"} w-full`}
        role="img"
        viewBox="0 0 100 100"
      >
        <path d="M0 25H100M0 50H100M0 75H100M25 0V100M50 0V100M75 0V100" stroke="currentColor" strokeOpacity=".12" strokeWidth=".7" />
        {points.length ? (
          <polyline
            fill="none"
            points={routePath(points)}
            stroke="var(--color-brand)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
        ) : null}
      </svg>
      <p className="px-3 pb-3 text-xs text-muted">
        Route preview stays on this device view; no map service receives your location.
      </p>
    </div>
  );
}

export default function RunTracker({
  date,
  unitSystem,
  weightKg,
  onSaved,
}: Props) {
  const [trackerState, setTrackerState] = useState<TrackerState>("idle");
  const [points, setPoints] = useState<RunRoutePoint[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [gpsWarning, setGpsWarning] = useState(false);
  const [backgroundWarning, setBackgroundWarning] = useState(false);
  const pointsRef = useRef<RunRoutePoint[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const startedAtIsoRef = useRef<string | null>(null);
  const elapsedBaseRef = useRef(0);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const distanceM = routeDistanceM(points);
  const avgPace = averagePaceSecPerKm(elapsedSeconds, distanceM);
  const recent = points.slice(-2);
  const currentPace =
    recent.length === 2
      ? averagePaceSecPerKm(
          Math.max(
            1,
            Math.round(
              (Date.parse(recent[1].recordedAt) -
                Date.parse(recent[0].recordedAt)) /
                1000,
            ),
          ),
          routeDistanceM(recent),
        )
      : null;

  function stopGps() {
    if (watchIdRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  async function releaseWakeLock() {
    const wakeLock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (wakeLock) await wakeLock.release();
  }

  async function requestWakeLock() {
    const wakeLockNavigator = navigator as Navigator & {
      wakeLock?: {
        request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
      };
    };
    if (!wakeLockNavigator.wakeLock) return;
    try {
      wakeLockRef.current = await wakeLockNavigator.wakeLock.request("screen");
    } catch {
      setBackgroundWarning(true);
    }
  }

  function watchLocation() {
    if (!navigator.geolocation) {
      setError("Location tracking is not available in this browser.");
      startedAtRef.current = null;
      setTrackerState("idle");
      return false;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point: RunRoutePoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          recordedAt: new Date(position.timestamp).toISOString(),
          accuracyM: position.coords.accuracy,
          altitudeM: position.coords.altitude,
        };
        const previous = pointsRef.current.at(-1);
        if (!validGpsStep(previous, point)) {
          setGpsWarning(true);
          return;
        }
        if (previous && routeDistanceM([previous, point]) < 5) return;
        const next = [...pointsRef.current, point].slice(-2500);
        pointsRef.current = next;
        setPoints(next);
      },
      (positionError) => {
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Location permission was denied. Enable location access to record this run."
            : "GPS could not get a reliable location. Move to an open area and try again.",
        );
        if (startedAtRef.current !== null) {
          elapsedBaseRef.current += Math.floor(
            (Date.now() - startedAtRef.current) / 1000,
          );
          setElapsedSeconds(elapsedBaseRef.current);
          startedAtRef.current = null;
        }
        setTrackerState("paused");
        stopGps();
        void releaseWakeLock();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
    return true;
  }

  function startRun() {
    setError("");
    setGpsWarning(false);
    setBackgroundWarning(false);
    pointsRef.current = [];
    setPoints([]);
    elapsedBaseRef.current = 0;
    setElapsedSeconds(0);
    startedAtRef.current = Date.now();
    startedAtIsoRef.current = new Date().toISOString();
    if (!watchLocation()) return;
    setTrackerState("running");
    void requestWakeLock();
  }

  function pauseRun() {
    if (startedAtRef.current !== null) {
      elapsedBaseRef.current += Math.floor(
        (Date.now() - startedAtRef.current) / 1000,
      );
    }
    startedAtRef.current = null;
    stopGps();
    void releaseWakeLock();
    setTrackerState("paused");
  }

  function resumeRun() {
    setError("");
    if (!watchLocation()) return;
    startedAtRef.current = Date.now();
    setTrackerState("running");
    void requestWakeLock();
  }

  async function finishRun() {
    if (startedAtRef.current !== null) {
      elapsedBaseRef.current += Math.floor(
        (Date.now() - startedAtRef.current) / 1000,
      );
      startedAtRef.current = null;
    }
    stopGps();
    await releaseWakeLock();
    const durationSeconds = Math.max(1, elapsedBaseRef.current);
    setElapsedSeconds(durationSeconds);
    setTrackerState("saving");
    setError("");
    try {
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loggedOn: date,
          startedAt: startedAtIsoRef.current,
          type: "run",
          title: "Run",
          durationMin: Math.max(1, Math.round(durationSeconds / 60)),
          durationSeconds,
          distanceM: Math.round(distanceM),
          avgPaceSecPerKm: avgPace,
          routePoints: pointsRef.current,
          caloriesEstimated: false,
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not save this run.");
      }
      setTrackerState("idle");
      pointsRef.current = [];
      setPoints([]);
      setElapsedSeconds(0);
      elapsedBaseRef.current = 0;
      onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save this run.",
      );
      setTrackerState("paused");
    }
  }

  useEffect(() => {
    if (trackerState !== "running") return;
    const interval = window.setInterval(() => {
      setElapsedSeconds(
        elapsedBaseRef.current +
          (startedAtRef.current === null
            ? 0
            : Math.floor((Date.now() - startedAtRef.current) / 1000)),
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, [trackerState]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && trackerState === "running") {
        setBackgroundWarning(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [trackerState]);

  useEffect(() => () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (wakeLockRef.current) void wakeLockRef.current.release();
  }, []);

  const distance = distanceM / (unitSystem === "metric" ? 1000 : 1609.344);
  const unitLabel = unitSystem === "metric" ? "km" : "mi";

  return (
    <section
      aria-labelledby="run-tracker-title"
      className="mt-5 rounded-3xl border border-line bg-card p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-brand">GPS run</p>
          <h2 className="mt-1 text-xl font-semibold" id="run-tracker-title">
            Track a run on this device
          </h2>
        </div>
        {trackerState === "idle" ? (
          <button
            className="min-h-11 rounded-xl bg-brand px-4 font-medium text-white"
            onClick={startRun}
            type="button"
          >
            Start run
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RunMetric label="Time" value={formatTime(elapsedSeconds)} />
        <RunMetric label="Distance" value={`${distance.toFixed(2)} ${unitLabel}`} />
        <RunMetric label="Current pace" value={formatPace(currentPace, unitSystem)} />
        <RunMetric label="Average pace" value={formatPace(avgPace, unitSystem)} />
      </div>

      <div className="mt-4">
        <RunRoutePreview points={points} />
      </div>

      {gpsWarning ? (
        <p className="mt-3 text-sm text-muted" role="status">
          Some GPS points were skipped because their accuracy or movement looked unreliable.
        </p>
      ) : null}
      {backgroundWarning ? (
        <p className="mt-3 text-sm text-muted" role="status">
          Mobile browsers may pause GPS when this page is backgrounded or the screen locks. Keep the app open; continuous background tracking is not guaranteed.
        </p>
      ) : null}
      {weightKg ? (
        <p className="mt-3 text-xs text-muted">
          Calories burned will be estimated from your latest logged weight when available.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}

      {trackerState === "running" || trackerState === "paused" || trackerState === "saving" ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {trackerState === "running" ? (
            <button className="min-h-11 rounded-xl border border-line px-4" onClick={pauseRun} type="button">
              Pause
            </button>
          ) : trackerState === "paused" ? (
            <button className="min-h-11 rounded-xl border border-line px-4" onClick={resumeRun} type="button">
              Resume
            </button>
          ) : null}
          <button
            className="min-h-11 rounded-xl bg-brand px-4 font-medium text-white disabled:opacity-60"
            disabled={trackerState !== "paused" && trackerState !== "running"}
            onClick={() => void finishRun()}
            type="button"
          >
            {trackerState === "saving" ? "Saving..." : "Finish run"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function RunMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
