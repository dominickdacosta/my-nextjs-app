"use client";

import { fromZonedTime } from "date-fns-tz";
import { addDays, todayFor } from "@/lib/health/dates";

export const healthConnectStateEvent = "vitals:health-connect-state";
function connectedStorageKey(userId: string): string {
  return `vitals.health-connect.${userId}.connected`;
}

function lastSyncStorageKey(userId: string): string {
  return `vitals.health-connect.${userId}.last-sync`;
}

type HealthConnectResult = {
  results?: string;
};

function localDateTimeAsUtc(date: string, timezone: string): string {
  return fromZonedTime(`${date}T00:00:00`, timezone)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
}

export function healthConnectDayRange(
  date: string,
  timezone: string,
): { startDate: string; endDate: string } {
  return {
    startDate: localDateTimeAsUtc(date, timezone),
    endDate: localDateTimeAsUtc(addDays(date, 1), timezone),
  };
}

function numericCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value)) {
    return Math.round(Number(value));
  }
  throw new Error("Health Connect returned an invalid step total.");
}

function countFromResult(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countFromResult(item), 0);
  }
  if (!value || typeof value !== "object") return numericCount(value);

  const record = value as Record<string, unknown>;
  const countKeys = [
    "Value",
    "value",
    "Sum",
    "sum",
    "Count",
    "count",
    "Total",
    "total",
    "TotalSteps",
    "totalSteps",
    "stepsCount",
    "steps_count",
  ];
  for (const key of countKeys) {
    if (key in record) return numericCount(record[key]);
  }

  for (const key of [
    "Results",
    "results",
    "Data",
    "data",
    "Result",
    "result",
    "Values",
    "values",
    "DataPoints",
    "dataPoints",
    "Records",
    "records",
  ]) {
    if (key in record) return countFromResult(record[key]);
  }

  throw new Error("Health Connect returned an unsupported step result.");
}

export function parseHealthConnectSteps(results: string | undefined): number {
  if (!results?.trim()) return 0;
  return countFromResult(JSON.parse(results) as unknown);
}

export function isHealthConnectConnected(userId: string): boolean {
  return window.localStorage.getItem(connectedStorageKey(userId)) === "true";
}

export function getHealthConnectLastSync(userId: string): string | null {
  return window.localStorage.getItem(lastSyncStorageKey(userId));
}

function saveHealthConnectState(
  userId: string,
  connected: boolean,
  lastSyncedAt: string | null,
) {
  window.localStorage.setItem(connectedStorageKey(userId), String(connected));
  if (lastSyncedAt) {
    window.localStorage.setItem(lastSyncStorageKey(userId), lastSyncedAt);
  }
  window.dispatchEvent(
    new CustomEvent(healthConnectStateEvent, {
      detail: { userId, connected, lastSyncedAt },
    }),
  );
}

export async function healthConnectAvailable(): Promise<boolean> {
  const { Capacitor } = await import("@capacitor/core");
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function connectHealthConnectSteps(userId: string): Promise<void> {
  const { HealthFitness } = await import("@capacitor/health-fitness");
  const noAdditionalPermissions = JSON.stringify({
    IsActive: false,
    AccessType: "READ",
  });
  await HealthFitness.requestHealthPermissions({
    customPermissions: JSON.stringify([
      { Variable: "STEPS", AccessType: "READ" },
    ]),
    allVariables: noAdditionalPermissions,
    fitnessVariables: noAdditionalPermissions,
    healthVariables: noAdditionalPermissions,
    profileVariables: noAdditionalPermissions,
    workoutVariables: noAdditionalPermissions,
  });
  saveHealthConnectState(userId, true, null);
}

export async function syncHealthConnectSteps(
  timezone: string,
  userId: string,
): Promise<{ steps: number; lastSyncedAt: string }> {
  const { HealthFitness } = await import("@capacitor/health-fitness");
  const date = todayFor(timezone);
  const range = healthConnectDayRange(date, timezone);
  const result = (await HealthFitness.getData({
    parameters: JSON.stringify({
      Variable: "STEPS",
      StartDate: range.startDate,
      EndDate: range.endDate,
      TimeUnit: "DAY",
      OperationType: "SUM",
      TimeUnitLength: 1,
      AdvancedQueryReturnType: "ALL_DATA",
      AdvancedQueryResultType: "RAW_DATA",
    }),
  })) as HealthConnectResult;
  const steps = parseHealthConnectSteps(result.results);
  const response = await fetch("/api/activity/steps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ steps }),
  });
  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error ?? "Could not save Health Connect steps.");
  }

  const lastSyncedAt = new Date().toISOString();
  saveHealthConnectState(userId, true, lastSyncedAt);
  return { steps, lastSyncedAt };
}
