"use client";

import { useCallback, useEffect, useState } from "react";
import AddTaskForm from "./add-task-form";
import TaskColumn from "./task-column";
import type {
  Task,
  TaskCompletion,
  TaskPoints,
  TaskRepeat,
  TaskStatus,
} from "../../lib/tasks";

const statuses: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "doing", label: "In Progress" },
  { value: "done", label: "Done" },
];

type UndoAction =
  | { kind: "status"; id: string; status: TaskStatus; message: string }
  | { kind: "delete"; task: Task; message: string };

type TaskDraft = {
  title: string;
  status: "todo";
  points: TaskPoints;
  assignee?: string;
  room?: string;
  due?: string;
  repeat?: TaskRepeat;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "The request could not be completed.");
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function HouseholdBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [today, setToday] = useState<Date | null>(null);
  const [activeStatus, setActiveStatus] = useState<TaskStatus>("todo");
  const [assigneeFilter, setAssigneeFilter] = useState("*");
  const [dueFilter, setDueFilter] = useState<"all" | "today" | "overdue">("all");
  const [scoreRange, setScoreRange] = useState<"week" | "all">("week");
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [addTaskSignal, setAddTaskSignal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshTasks = useCallback(async () => {
    try {
      setTasks(await request<Task[]>("/api/tasks"));
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load household tasks.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTasks();
    const interval = window.setInterval(() => void refreshTasks(), 4000);
    return () => window.clearInterval(interval);
  }, [refreshTasks]);

  useEffect(() => {
    const updateDate = () => setToday(new Date());
    updateDate();
    const interval = window.setInterval(updateDate, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!undoAction) return;
    const timeout = window.setTimeout(() => setUndoAction(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [undoAction]);

  const todayString = today ? localDateString(today) : "";
  const completionArchive: TaskCompletion[] = tasks.flatMap((task) => {
    if (task.completionHistory?.length) return task.completionHistory;
    if (task.status !== "done") return [];
    return [
      {
        taskId: task.id,
        title: task.title,
        ...(task.assignee && { assignee: task.assignee }),
        points: task.points,
        completedAt: task.createdAt,
        completedOn: task.createdAt.slice(0, 10),
      },
    ];
  }).sort((first, second) =>
    second.completedAt.localeCompare(first.completedAt),
  );
  const todayCompletions = completionArchive.filter(
    (completion) => completion.completedOn === todayString,
  );
  const olderCompletions = completionArchive.filter(
    (completion) => completion.completedOn !== todayString,
  );
  const completionTasks = new Map(tasks.map((task) => [task.id, task]));
  const todayDueTaskIds = new Set(
    tasks.filter((task) => task.due === todayString).map((task) => task.id),
  );
  todayCompletions.forEach((completion) => {
    if (
      completion.dueBefore === todayString ||
      completionTasks.get(completion.taskId)?.due === todayString
    ) {
      todayDueTaskIds.add(completion.taskId);
    }
  });
  const finishedTodayTaskIds = new Set(
    todayCompletions
      .filter(
        (completion) =>
          completion.dueBefore === todayString ||
          completionTasks.get(completion.taskId)?.due === todayString,
      )
      .map((completion) => completion.taskId),
  );
  const finishedToday = finishedTodayTaskIds.size;
  const dueTodayCount = todayDueTaskIds.size;
  const thisWeekStart = (() => {
    if (!today) return todayString;
    const monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return localDateString(monday);
  })();
  const scoreCompletions =
    scoreRange === "week"
      ? completionArchive.filter(
          (completion) =>
            completion.completedOn >= thisWeekStart &&
            completion.completedOn <= todayString,
        )
      : completionArchive;
  const pointsByAssignee = new Map<string, number>();
  scoreCompletions.forEach((completion) => {
    if (!completion.assignee) return;
    pointsByAssignee.set(
      completion.assignee,
      (pointsByAssignee.get(completion.assignee) ?? 0) + completion.points,
    );
  });
  const leaderboard = [...pointsByAssignee.entries()].sort(
    ([, first], [, second]) => second - first,
  );
  const topScore = leaderboard[0]?.[1];
  const todayDoneTaskIds = new Set(todayCompletions.map((completion) => completion.taskId));
  const upcomingTasks = tasks
    .filter(
      (task) =>
        task.due &&
        task.due > todayString &&
        (task.status !== "done" || Boolean(task.repeat)) &&
        (assigneeFilter === "*" ||
          (assigneeFilter === "" ? !task.assignee : task.assignee === assigneeFilter)),
    )
    .sort((first, second) => (first.due ?? "").localeCompare(second.due ?? ""))
    .slice(0, 6);

  async function createTask(task: TaskDraft | TaskDraft[]) {
    await request<Task | Task[]>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(task),
    });
    setActiveStatus("todo");
    await refreshTasks();
  }

  async function changeStatus(id: string, status: TaskStatus) {
    const previousTask = tasks.find((task) => task.id === id);
    try {
      await request<Task>(`/api/tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...(status === "done" && { completedOn: localDateString(new Date()) }),
        }),
      });
      if (status === "done" && previousTask && previousTask.status !== "done") {
        setUndoAction({
          kind: "status",
          id,
          status: previousTask.status,
          message: `“${previousTask.title}” marked done.`,
        });
      } else {
        setUndoAction(null);
      }
      await refreshTasks();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update task.");
    }
  }

  async function removeTask(id: string) {
    try {
      const deleted = await request<Task>(
        `/api/tasks/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      setUndoAction({
        kind: "delete",
        task: deleted,
        message: `“${deleted.title}” deleted.`,
      });
      await refreshTasks();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete task.");
    }
  }

  async function undo() {
    if (!undoAction) return;
    try {
      if (undoAction.kind === "status") {
        await request<Task>(`/api/tasks/${encodeURIComponent(undoAction.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: undoAction.status,
            ...(undoAction.status === "done" && {
              completedOn: localDateString(new Date()),
            }),
          }),
        });
      } else {
        await request<Task>(
          `/api/tasks/${encodeURIComponent(undoAction.task.id)}/restore`,
          {
            method: "POST",
            body: JSON.stringify(undoAction.task),
          },
        );
      }
      setUndoAction(null);
      await refreshTasks();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not undo that action.");
    }
  }

  const assignees = [
    ...new Set(
      tasks
        .map((task) => task.assignee)
        .filter((assignee): assignee is string => Boolean(assignee)),
    ),
  ].sort((first, second) => first.localeCompare(second));
  const hasUnassignedTasks = tasks.some((task) => !task.assignee);
  const visibleTasks = tasks.filter((task) => {
    const matchesAssignee =
      assigneeFilter === "*"
        ? true
        : assigneeFilter === ""
          ? !task.assignee
          : task.assignee === assigneeFilter;
    const completedToday = todayDoneTaskIds.has(task.id);
    const matchesDue =
      dueFilter === "all" ||
      (dueFilter === "today" &&
        (task.due === todayString || (task.status === "done" && completedToday))) ||
      (dueFilter === "overdue" &&
        task.status !== "done" &&
        Boolean(task.due && task.due < todayString));
    const isVisibleDoneTask =
      task.status !== "done" || completedToday;
    return matchesAssignee && matchesDue && isVisibleDoneTask;
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl bg-gradient-to-br from-amber-50 via-orange-50 to-emerald-50 px-4 pb-10 pt-6 font-sans text-stone-950 antialiased sm:px-6 sm:pt-10">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">
            Our home
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-emerald-950 sm:text-4xl">
            House tasks
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            A little teamwork makes a happy home.
          </p>
        </div>
        <div className="flex min-w-40 items-center gap-3 rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 shadow-sm">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-xl"
            aria-hidden="true"
          >
            📅
          </span>
          <span>
            <span className="block text-xs font-bold uppercase tracking-widest text-amber-800">
              {today
                ? today.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })
                : " "}
            </span>
            <span className="mt-0.5 block font-semibold text-stone-900">
              {today
                ? today.toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                  })
                : " "}
            </span>
          </span>
        </div>
      </header>

      <section
        className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3"
        aria-label="Family progress today"
      >
        <span className="text-lg" aria-hidden="true">
          🌱
        </span>
        <p className="text-sm font-semibold text-emerald-950">
          <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            Whole family ·{" "}
          </span>
          {dueTodayCount
            ? `${finishedToday} of ${dueTodayCount} tasks due today finished`
            : "No tasks due today"}
        </p>
        <div
          className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-emerald-100"
          role="progressbar"
          aria-label="Tasks due today completed"
          aria-valuemin={0}
          aria-valuemax={Math.max(dueTodayCount, 1)}
          aria-valuenow={finishedToday}
        >
          <div
            className="h-full rounded-full bg-emerald-600 transition-all"
            style={{
              width: dueTodayCount
                ? `${Math.min((finishedToday / dueTodayCount) * 100, 100)}%`
                : "0%",
            }}
          />
        </div>
      </section>

      {upcomingTasks.length > 0 && (
        <section
          className="mb-5 rounded-xl border border-sky-100 bg-sky-50/70 p-4"
          aria-labelledby="upcoming-title"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-sky-950" id="upcoming-title">
              Tomorrow & upcoming
            </h2>
            <span className="text-xs text-sky-800">Next 6 chores</span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingTasks.map((task) => (
              <li
                className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm"
                key={task.id}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-stone-800">
                    {task.title}
                  </span>
                  <span className="block truncate text-xs text-stone-500">
                    {task.assignee ?? "Anyone"}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-900">
                  {task.due ===
                  localDateString(
                    new Date(
                      (today ?? new Date()).getFullYear(),
                      (today ?? new Date()).getMonth(),
                      (today ?? new Date()).getDate() + 1,
                    ),
                  )
                    ? "Tomorrow"
                    : new Date(`${task.due}T00:00:00`).toLocaleDateString(
                        undefined,
                        { weekday: "short", month: "short", day: "numeric" },
                      )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="board-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
              One thing at a time
            </p>
            <h2
              className="mt-1 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl"
              id="board-title"
            >
              The task board
            </h2>
          </div>
          <AddTaskForm
            assignees={assignees}
            onCreate={createTask}
            openSignal={addTaskSignal}
          />
        </div>

        {error && (
          <p
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="my-5 flex flex-wrap items-center gap-3">
          <label
            className="text-sm font-semibold text-stone-800"
            htmlFor="assignee-filter"
          >
            Who
          </label>
          <select
            className="min-h-11 min-w-36 rounded-lg border border-stone-300 bg-white px-3 text-base"
            id="assignee-filter"
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
          >
            <option value="*">Everyone</option>
            {assignees.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
            {hasUnassignedTasks && <option value="">Unassigned</option>}
          </select>
          <div
            className="flex rounded-lg border border-stone-300 bg-white p-1"
            aria-label="Filter tasks by due date"
          >
            {(["all", "today", "overdue"] as const).map((filter) => (
              <button
                className={`min-h-9 rounded-md px-3 text-sm font-semibold ${
                  dueFilter === filter
                    ? "bg-emerald-800 text-white"
                    : "text-stone-700 hover:bg-stone-100"
                }`}
                key={filter}
                type="button"
                aria-pressed={dueFilter === filter}
                onClick={() => setDueFilter(filter)}
              >
                {filter === "all"
                  ? "All dates"
                  : filter === "today"
                    ? "Today"
                    : "Overdue"}
              </button>
            ))}
          </div>
        </div>

        <nav
          className="my-4 grid grid-cols-3 gap-2 md:hidden"
          role="tablist"
          aria-label="Task status"
        >
          {statuses.map((status) => {
            const count = visibleTasks.filter(
              (task) => task.status === status.value,
            ).length;
            const selected = activeStatus === status.value;
            return (
              <button
                key={status.value}
                id={`tab-${status.value}`}
                className={`min-h-12 rounded-xl px-2 text-sm font-bold ${
                  selected
                    ? "bg-emerald-800 text-white shadow-sm"
                    : "border border-stone-300 bg-white text-stone-700"
                }`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`column-${status.value}`}
                onClick={() => setActiveStatus(status.value)}
              >
                {status.label}
                <span className="ml-1 opacity-75">({count})</span>
              </button>
            );
          })}
        </nav>

        {loading && tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-500">
            Loading tasks…
          </p>
        ) : (
          <div className="grid items-start gap-4 md:mt-6 md:grid-cols-3">
            {statuses.map((status) => (
              <TaskColumn
                key={status.value}
                status={status.value}
                tasks={visibleTasks.filter((task) => task.status === status.value)}
                active={activeStatus === status.value}
                onStatusChange={changeStatus}
                onDelete={removeTask}
                onAddTask={() => {
                  setActiveStatus("todo");
                  setAddTaskSignal((signal) => signal + 1);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {undoAction && (
        <div
          className="fixed inset-x-3 bottom-4 z-20 mx-auto flex max-w-lg items-center justify-between gap-4 rounded-xl bg-stone-900 px-4 py-3 text-sm text-white shadow-xl sm:inset-x-auto sm:bottom-6"
          role="status"
        >
          <span>{undoAction.message}</span>
          <button
            className="min-h-11 shrink-0 rounded-lg bg-white px-4 font-bold text-stone-900 hover:bg-amber-100"
            type="button"
            onClick={() => void undo()}
          >
            Undo
          </button>
        </div>
      )}

      <section
        className="mt-5 rounded-2xl border border-stone-200 bg-white/75 p-4 shadow-sm sm:p-5"
        aria-labelledby="archive-title"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-stone-500">
              Every little win
            </p>
            <h2
              className="mt-1 text-lg font-bold text-emerald-950"
              id="archive-title"
            >
              Done archive
            </h2>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
            {olderCompletions.length}
          </span>
        </div>
        {olderCompletions.length ? (
          <details className="mt-2 border-t border-stone-100 pt-2">
            <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-emerald-800 hover:text-emerald-950">
              Show older completions ({olderCompletions.length})
            </summary>
            <ul className="divide-y divide-stone-100">
              {olderCompletions.map((completion, index) => (
                <li
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                  key={`${completion.taskId}-${completion.completedAt}-${index}`}
                >
                  <span className="min-w-0 truncate text-stone-700">
                    ✓ {completion.title}
                  </span>
                  <span className="shrink-0 text-xs text-stone-500">
                    {completion.assignee ? `${completion.assignee} · ` : ""}
                    {new Date(
                      `${completion.completedOn}T00:00:00`,
                    ).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="mt-3 text-sm text-stone-600">
            No older completions.
          </p>
        )}
      </section>

      <section
        className="mt-8 rounded-2xl border border-amber-200 bg-white/75 p-4 shadow-sm sm:p-5"
        aria-labelledby="points-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-800">
              A little thank-you
            </p>
            <h2 className="mt-1 text-lg font-bold text-emerald-950" id="points-title">
              ⭐ Good deeds club
            </h2>
          </div>
          <div className="flex rounded-lg border border-amber-200 bg-white p-1">
            {(["week", "all"] as const).map((range) => (
              <button
                className={`min-h-9 rounded-md px-3 text-sm font-semibold ${
                  scoreRange === range
                    ? "bg-amber-100 text-amber-950"
                    : "text-stone-600 hover:bg-stone-50"
                }`}
                key={range}
                type="button"
                aria-pressed={scoreRange === range}
                onClick={() => setScoreRange(range)}
              >
                {range === "week" ? "This week" : "All time"}
              </button>
            ))}
          </div>
          {leaderboard.length ? (
            <ul className="flex flex-wrap gap-2">
              {leaderboard.map(([assignee, points]) => (
                <li
                  className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-sm"
                  key={assignee}
                >
                  <span aria-hidden="true">
                    {points === topScore ? "⭐" : "🌱"}
                  </span>
                  <span className="font-semibold text-stone-800">{assignee}</span>
                  <span className="font-bold text-amber-900">
                    {points} {points === 1 ? "pt" : "pts"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-600">
              The first good deed earns the first star!
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
