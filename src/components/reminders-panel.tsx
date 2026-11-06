"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";

type Reminder = {
  id: string;
  kind: "medication" | "hydration" | "wellbeing";
  daysOfWeek: number[];
  enabled: boolean;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load reminders.");
  return (await response.json()) as T;
}

async function sendJson(url: string, method: string, data?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  if (!response.ok) {
    const result = (await response.json()) as { error?: string };
    throw new Error(result.error ?? "Could not update reminders.");
  }
}

function decodeVapidKey(value: string): ArrayBuffer {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(base64);
  const buffer = new ArrayBuffer(decoded.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return buffer;
}

export default function RemindersPanel() {
  const { data: reminders, error, mutate } = useSWR<Reminder[]>(
    "/api/reminders",
    fetchJson,
  );
  const [kind, setKind] = useState<Reminder["kind"]>("wellbeing");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function addReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await sendJson("/api/reminders", "POST", {
        kind,
        daysOfWeek: [],
      });
      await mutate();
      setMessage("Reminder saved. Turn on push notifications on this device to receive it.");
    } catch (actionError) {
      setMessage(
        actionError instanceof Error
          ? actionError.message
          : "Could not save this reminder.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function enablePush() {
    setBusy(true);
    setMessage("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Push notifications are not supported by this browser.");
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error("Push notifications are not configured for this deployment.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission was not granted.");
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(publicKey),
        }));
      await sendJson("/api/push-subscriptions", "POST", subscription.toJSON());
      setMessage("Push notifications are enabled on this device.");
    } catch (actionError) {
      setMessage(
        actionError instanceof Error
          ? actionError.message
          : "Could not enable push notifications.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeReminder(id: string) {
    setBusy(true);
    setMessage("");
    try {
      await sendJson(`/api/reminders/${id}`, "DELETE");
      await mutate();
    } catch (actionError) {
      setMessage(
        actionError instanceof Error
          ? actionError.message
          : "Could not remove this reminder.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await sendJson("/api/push-subscriptions", "DELETE", {
          endpoint: subscription.endpoint,
        });
        await subscription.unsubscribe();
      }
      setMessage("Push notifications are disabled on this device.");
    } catch (actionError) {
      setMessage(
        actionError instanceof Error
          ? actionError.message
          : "Could not disable push notifications.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-line bg-card p-5 sm:p-7">
      <h2 className="text-xl font-semibold">Reminders</h2>
      <p className="mt-1 text-sm text-muted">
        Set up a generic daily check-in. Hobby deployments send reminders during the daily run (around 09:00 UTC; local time varies). Notifications never include health or medication details.
      </p>
      {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error.message}</p> : null}
      {message ? <p aria-live="polite" className="mt-3 text-sm text-brand" role="status">{message}</p> : null}
      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={(event) => void addReminder(event)}>
        <label className="grid gap-2 text-sm font-medium">
          Reminder
          <select
            className="min-h-12 rounded-xl border border-line bg-paper px-3"
            onChange={(event) => setKind(event.target.value as Reminder["kind"])}
            value={kind}
          >
            <option value="wellbeing">Wellbeing check-in</option>
            <option value="hydration">Hydration check-in</option>
            <option value="medication">Medication check-in</option>
          </select>
        </label>
        <button
          className="min-h-12 self-end rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-60"
          disabled={busy}
          type="submit"
        >
          Add reminder
        </button>
      </form>
      <ul className="mt-4 divide-y divide-line">
        {reminders?.map((reminder) => (
          <li className="flex items-center justify-between gap-3 py-3" key={reminder.id}>
            <span className="text-sm">
              {reminder.kind === "wellbeing"
                ? "Wellbeing check-in"
                : reminder.kind === "hydration"
                  ? "Hydration check-in"
                  : "Medication check-in"}{" "}
              · daily
            </span>
            <button
              className="min-h-10 rounded-lg px-3 text-sm text-muted underline"
              disabled={busy}
              onClick={() => void removeReminder(reminder.id)}
              type="button"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium disabled:opacity-60"
          disabled={busy}
          onClick={() => void enablePush()}
          type="button"
        >
          Enable on this device
        </button>
        <button
          className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium disabled:opacity-60"
          disabled={busy}
          onClick={() => void disablePush()}
          type="button"
        >
          Disable on this device
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">
        Reminders require browser permission and configured push keys. They are best-effort, not a substitute for medication instructions.
      </p>
    </section>
  );
}
