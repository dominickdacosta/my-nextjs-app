"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

type StravaStatus = {
  configured: boolean;
  connected: boolean;
  lastSyncedAt: string | null;
  syncingHistory: boolean;
};

async function fetchStatus(url: string): Promise<StravaStatus> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load Strava connection status.");
  return (await response.json()) as StravaStatus;
}

export default function StravaPanel({
  onSynced,
}: {
  onSynced: () => void;
}) {
  const { data, error, mutate } = useSWR<StravaStatus>("/api/strava", fetchStatus);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("strava");
    if (!status) return;

    if (status === "connected") {
      setNotice("Strava connected. Sync activities to import your history.");
    } else if (status === "cancelled") {
      setNotice("Strava connection was cancelled.");
    } else if (status === "error") {
      setActionError("Strava could not be connected. Check its configuration and try again.");
    }

    url.searchParams.delete("strava");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  async function syncActivities() {
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      const response = await fetch("/api/strava/sync", { method: "POST" });
      const result = (await response.json()) as {
        imported?: number;
        hasMore?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Could not sync Strava activities.");
      }
      setNotice(
        `${result.imported ?? 0} new activities imported.${
          result.hasMore ? " More history is available; sync again to continue." : ""
        }`,
      );
      await mutate();
      onSynced();
    } catch (syncError) {
      setActionError(
        syncError instanceof Error
          ? syncError.message
          : "Could not sync Strava activities.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch("/api/strava", { method: "DELETE" });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not disconnect Strava.");
      }
      setNotice("Strava disconnected. Previously imported activities remain in your log.");
      await mutate();
    } catch (disconnectError) {
      setActionError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Could not disconnect Strava.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="strava-title"
      className="mt-5 rounded-3xl border border-line bg-card p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-brand">Optional import</p>
          <h2 className="mt-1 text-xl font-semibold" id="strava-title">
            Strava
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Import runs and other activities you authorize. Imported activities are deduplicated and remain in Vitals if you disconnect.
          </p>
        </div>
        {data?.connected ? (
          <div className="flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-xl bg-brand px-4 font-medium text-white disabled:opacity-60"
              disabled={busy}
              onClick={() => void syncActivities()}
              type="button"
            >
              {busy ? "Working..." : "Sync activities"}
            </button>
            <button
              className="min-h-11 rounded-xl border border-line px-4"
              disabled={busy}
              onClick={() => void disconnect()}
              type="button"
            >
              Disconnect
            </button>
          </div>
        ) : data?.configured ? (
          <a
            className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 font-medium text-white"
            href="/api/strava/connect"
          >
            Connect Strava
          </a>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error.message}</p> : null}
      {data && !data.configured ? (
        <p className="mt-3 text-sm text-muted">
          Strava is not configured for this deployment. A connection will only be offered after valid OAuth credentials are added.
        </p>
      ) : null}
      {data?.connected ? (
        <p className="mt-3 text-sm text-muted">
          Connected{data.lastSyncedAt
            ? ` · Last synced ${new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(data.lastSyncedAt))}`
            : " · Historical activity sync is ready"}
          {data.syncingHistory ? " · Historical import is still in progress" : ""}
        </p>
      ) : null}
      {notice ? <p className="mt-3 text-sm text-brand" role="status">{notice}</p> : null}
      {actionError ? <p className="mt-3 text-sm text-red-700" role="alert">{actionError}</p> : null}
    </section>
  );
}
