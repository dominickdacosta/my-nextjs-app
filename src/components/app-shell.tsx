"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { APP_NAME } from "@/lib/constants";
import {
  healthConnectAvailable,
  isHealthConnectConnected,
  syncHealthConnectSteps,
} from "@/lib/health/health-connect";
import { updateDayOptimistically, type DayPayload, type QuickLogInput } from "@/lib/health/day";
import type { TrainingType } from "@/lib/health/workouts";
import type { UnitSystem } from "@/lib/health/units";
import QuickLogSheet from "@/components/quick-log/quick-log-sheet";

const navigation = [
  { label: "Today", href: "/", icon: "◷" },
  { label: "Food", href: "/food", icon: "◉" },
  { label: "Train", href: "/train", icon: "↗" },
  { label: "Trends", href: "/trends", icon: "⌁" },
  { label: "More", href: "/more", icon: "⋯" },
];

type AppContextValue = {
  selectedDate: string | null;
  setSelectedDate: (date: string | null) => void;
  trainingType: TrainingType;
  setTrainingType: (type: TrainingType) => void;
  trainingQuickOpen: boolean;
  setTrainingQuickOpen: (open: boolean) => void;
  userId: string | null;
  moreQuickKind: "sleep" | "vitals" | "meds" | null;
  moreQuickOpen: boolean;
  setMoreQuickOpen: (open: boolean) => void;
  openQuickLog: (kind?: "weight" | "water") => void;
  submitLog: (input: QuickLogInput) => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used inside AppShell.");
  return context;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load your health data.");
  return (await response.json()) as T;
}

function dayKey(date: string | null): string {
  return date ? `/api/day?date=${encodeURIComponent(date)}` : "/api/day";
}

export default function AppShell({
  children,
  isPreview,
}: Readonly<{ children: React.ReactNode; isPreview: boolean }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: profile } = useSWR<{
    userId: string;
    unitSystem: UnitSystem;
    timezone: string;
  }>("/api/profile", fetchJson);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [trainingType, setTrainingType] = useState<TrainingType>("strength");
  const [trainingQuickOpen, setTrainingQuickOpen] = useState(false);
  const [moreQuickKind, setMoreQuickKind] = useState<
    "sleep" | "vitals" | "meds" | null
  >(null);
  const [moreQuickOpen, setMoreQuickOpen] = useState(false);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [initialLogKind, setInitialLogKind] = useState<
    "weight" | "water" | null
  >(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js")
        .catch((error: unknown) => {
          console.error("Service worker registration failed.", error);
        });
    }
  }, []);

  useEffect(() => {
    if (!profile?.timezone || !profile.userId) return;
    const timezone = profile.timezone;
    const userId = profile.userId;
    let disposed = false;
    let removeAppListener: (() => void) | undefined;

    async function syncSteps() {
      if (!isHealthConnectConnected(userId)) return;
      try {
        await syncHealthConnectSteps(timezone, userId);
        await mutate(
          (key) =>
            typeof key === "string" &&
            (key === "/api/day" || key.startsWith("/api/day?")),
        );
      } catch {
        if (!disposed) {
          setToast("Steps could not sync. Open More to refresh or reconnect Health Connect.");
        }
      }
    }

    async function listenForResume() {
      if (!(await healthConnectAvailable()) || disposed) return;
      const { App } = await import("@capacitor/app");
      const listener = await App.addListener(
        "appStateChange",
        ({ isActive }) => {
          if (isActive) void syncSteps();
        },
      );
      if (disposed) {
        await listener.remove();
      } else {
        removeAppListener = () => {
          void listener.remove();
        };
        await syncSteps();
      }
    }

    void listenForResume().catch(() => {
      if (!disposed) {
        setToast("Steps could not sync. Open More to refresh or reconnect Health Connect.");
      }
    });

    return () => {
      disposed = true;
      removeAppListener?.();
    };
  }, [mutate, profile?.timezone, profile?.userId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const contextValue = useMemo<AppContextValue>(
    () => ({
      selectedDate,
      setSelectedDate,
      trainingType,
      setTrainingType,
      trainingQuickOpen,
      setTrainingQuickOpen,
      userId: profile?.userId ?? null,
      moreQuickKind,
      moreQuickOpen,
      setMoreQuickOpen,
      openQuickLog: (kind) => {
        setInitialLogKind(kind ?? null);
        setQuickLogOpen(true);
      },
      submitLog: async (input) => {
        const key = dayKey(selectedDate);
        const id = `pending-${crypto.randomUUID()}`;
        const loggedAt = new Date().toISOString();
        try {
          await mutate<DayPayload | undefined>(
            key,
            async (current) => {
              const route =
                input.kind === "water"
                  ? "/api/water-entries"
                  : input.kind === "weight"
                    ? "/api/body-measurements"
                    : "/api/checkins";
              const response = await fetch(route, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
              });
              if (!response.ok) {
                const result = (await response.json()) as { error?: string };
                throw new Error(result.error ?? "Could not save this log.");
              }
              if (current) {
                return updateDayOptimistically(current, input, id, loggedAt);
              }
              return fetchJson<DayPayload>(key);
            },
            {
              optimisticData: (current) =>
                current
                  ? updateDayOptimistically(current, input, id, loggedAt)
                  : current,
              rollbackOnError: true,
              revalidate: true,
            },
          );
          setToast("Saved.");
        } catch (error) {
          setToast(
            error instanceof Error ? error.message : "Could not save this log.",
          );
          throw error;
        }
      },
    }),
    [
      moreQuickKind,
      moreQuickOpen,
      mutate,
      profile?.userId,
      selectedDate,
      trainingQuickOpen,
      trainingType,
    ],
  );

  const unitSystem: UnitSystem = profile?.unitSystem ?? "metric";

  return (
    <AppContext.Provider value={contextValue}>
      {isPreview ? (
        <div className="bg-brand px-4 py-2 text-center text-sm text-white">
          Preview environment
        </div>
      ) : null}
      <div className="min-h-screen lg:pl-64">
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-paper p-6 lg:flex lg:flex-col">
          <Link className="flex items-center gap-3 font-semibold" href="/">
            <span className="grid size-10 place-items-center rounded-2xl bg-brand text-white">
              V
            </span>
            {APP_NAME}
          </Link>
          <nav aria-label="Main navigation" className="mt-10 grid gap-2">
            {navigation.map((item) => (
              <NavItem
                active={pathname === item.href}
                item={item}
                key={item.href}
              />
            ))}
          </nav>
          <p className="mt-auto text-xs leading-5 text-muted">
            Personal tracking, not medical advice.
          </p>
        </aside>

        <div className="min-h-screen">
          {children}
          <nav
            aria-label="Main navigation"
            className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-paper/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
          >
            {navigation.map((item) => (
              <NavItem
                active={pathname === item.href}
                item={item}
                key={item.href}
                mobile
              />
            ))}
          </nav>
        </div>
      </div>

      <button
        aria-label="Open quick log"
        className="fixed bottom-20 right-4 z-40 grid size-14 place-items-center rounded-full bg-brand text-3xl leading-none text-white shadow-lg focus-visible:outline-white lg:bottom-8 lg:right-8"
        onClick={() => {
          setInitialLogKind(null);
          setQuickLogOpen(true);
        }}
        type="button"
      >
        +
      </button>
      <QuickLogSheet
        date={selectedDate}
        initialKind={initialLogKind}
        onFoodClick={() => {
          setQuickLogOpen(false);
          setInitialLogKind(null);
          router.push("/food");
        }}
        onTrainClick={(type) => {
          setQuickLogOpen(false);
          setInitialLogKind(null);
          setTrainingType(type);
          setTrainingQuickOpen(true);
          router.push("/train");
        }}
        onMoreClick={(kind) => {
          setQuickLogOpen(false);
          setInitialLogKind(null);
          setMoreQuickKind(kind);
          setMoreQuickOpen(true);
          router.push("/more");
        }}
        onClose={() => {
          setQuickLogOpen(false);
          setInitialLogKind(null);
        }}
        onSubmit={contextValue.submitLog}
        open={quickLogOpen}
        unitSystem={unitSystem}
      />
      {toast ? (
        <div
          aria-live="polite"
          className="fixed bottom-36 left-4 right-4 z-50 mx-auto max-w-md rounded-xl bg-ink px-4 py-3 text-center text-sm text-white shadow-lg lg:bottom-8"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </AppContext.Provider>
  );
}

function NavItem({
  item,
  active,
  mobile = false,
}: {
  item: (typeof navigation)[number];
  active: boolean;
  mobile?: boolean;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${
        active ? "bg-brand/10 text-brand" : "text-muted"
      } ${mobile ? "flex-col justify-center gap-0 py-2 text-xs" : ""}`}
      href={item.href}
    >
      <span aria-hidden="true" className={mobile ? "text-lg leading-5" : "text-lg"}>
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}
