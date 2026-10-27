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

export default function HouseholdBoard({
  isPreview = false,
}: {
  isPreview?: boolean;
}) {
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
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 pb-12 pt-6 text-[#24352c] antialiased sm:px-7 sm:pt-9 lg:px-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-5 border-b border-[#e5e7df] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#285943] text-lg font-bold text-white" aria-hidden="true">
              H
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#627768]">
                Home Together
              </p>
              <p className="mt-0.5 text-xs text-[#7b857d]">A little teamwork makes a happy home</p>
            </div>
          </div>
          {isPreview && (
            <span className="mt-3 inline-flex rounded-full bg-[#e5eee6] px-2.5 py-1 text-xs font-bold text-[#285943]">
              Preview deployment
            </span>
          )}
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#23382c] sm:text-[2.6rem]">
            Today at home
          </h1>
        </div>
        <div className="flex min-w-44 items-center gap-3 rounded-2xl border border-[#e5e7df] bg-white px-4 py-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f7f0df] text-lg text-[#9b7634]"
            aria-hidden="true"
          >
            ◷
          </span>
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wider text-[#7b857d]">
              {today
                ? today.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })
                : " "}
            </span>
            <span className="mt-0.5 block font-semibold text-[#293a30]">
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
        className="mb-7 flex flex-wrap items-center gap-3 rounded-2xl border border-[#dfe8df] bg-[#e5eee6] px-4 py-3.5"
        aria-label="Family progress today"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/80 text-base text-[#54745b]" aria-hidden="true">
          ✓
        </span>
        <p className="text-sm font-semibold text-[#293a30]">
          <span className="mr-1 text-xs font-bold uppercase tracking-wide text-[#54745b]">
            Whole family ·{" "}
          </span>
          {dueTodayCount
            ? `${finishedToday} of ${dueTodayCount} tasks due today finished`
            : "No tasks due today"}
        </p>
        <div
          className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-white/80"
          role="progressbar"
          aria-label="Tasks due today completed"
          aria-valuemin={0}
          aria-valuemax={Math.max(dueTodayCount, 1)}
          aria-valuenow={finishedToday}
        >
          <div
            className="h-full rounded-full bg-[#588263] transition-all"
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
          className="mb-7 rounded-2xl border border-[#e5e7df] bg-white p-4 sm:p-5"
          aria-labelledby="upcoming-title"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#293a30]" id="upcoming-title">
              Tomorrow & upcoming
            </h2>
            <span className="text-xs text-[#7b857d]">Next 6 chores</span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingTasks.map((task) => (
              <li
                className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[#edf0e9] bg-[#fbfbf9] px-3 py-2.5 text-sm"
                key={task.id}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[#293a30]">
                    {task.title}
                  </span>
                  <span className="block truncate text-xs text-[#7b857d]">
                    {task.assignee ?? "Anyone"}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-[#e5eee6] px-2.5 py-1 text-xs font-semibold text-[#285943]">
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
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#718074]">
              Shared family plan
            </p>
            <h2
              className="mt-1 text-2xl font-bold tracking-tight text-[#23382c] sm:text-3xl"
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
            className="mt-4 rounded-xl border border-[#f1d6d1] bg-[#fff4f1] p-3 text-sm text-[#9b493c]"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="my-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#e5e7df] bg-white p-3">
          <label
            className="text-sm font-semibold text-[#46574b]"
            htmlFor="assignee-filter"
          >
            Who
          </label>
          <select
            className="min-h-11 min-w-36 rounded-xl border border-[#dfe4dc] bg-[#fbfbf9] px-3 text-sm text-[#293a30] focus:border-[#73917a]"
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
            className="flex flex-wrap rounded-full border border-[#e5e7df] bg-[#f7f7f3] p-1"
            role="group"
            aria-label="Filter tasks by due date"
          >
            {(["all", "today", "overdue"] as const).map((filter) => (
              <button
                className={`min-h-9 rounded-full px-3 text-sm font-semibold ${
                  dueFilter === filter
                    ? "bg-[#285943] text-white shadow-sm"
                    : "text-[#5d6b60] hover:bg-white"
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
          className="my-4 grid grid-cols-3 gap-2 lg:hidden"
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
                className={`min-h-12 rounded-xl px-2 text-sm font-bold transition-colors ${
                  selected
                    ? "bg-[#285943] text-white shadow-sm"
                    : "border border-[#e5e7df] bg-white text-[#526156] hover:bg-[#f1f3ed]"
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
          <div className="rounded-2xl border border-[#e5e7df] bg-white px-5 py-10 text-center text-sm text-[#68776d]" role="status">
            <span className="mx-auto mb-3 block h-6 w-6 animate-spin rounded-full border-2 border-[#dce6db] border-t-[#285943]" aria-hidden="true" />
            Loading your family tasks…
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:mt-6 lg:grid-cols-3">
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
          className="fixed inset-x-3 bottom-4 z-20 mx-auto flex max-w-lg items-center justify-between gap-4 rounded-xl bg-[#24352c] px-4 py-3 text-sm text-white shadow-xl sm:inset-x-auto sm:bottom-6"
          role="status"
        >
          <span>{undoAction.message}</span>
          <button
            className="min-h-11 shrink-0 rounded-lg bg-white px-4 font-bold text-[#285943] hover:bg-[#e5eee6]"
            type="button"
            onClick={() => void undo()}
          >
            Undo
          </button>
        </div>
      )}

      <section
        className="mt-7 rounded-2xl border border-[#e5e7df] bg-white p-4 sm:p-5"
        aria-labelledby="archive-title"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#7b857d]">
              Every little win
            </p>
            <h2
              className="mt-1 text-lg font-bold text-[#293a30]"
              id="archive-title"
            >
              Done archive
            </h2>
          </div>
          <span className="rounded-full bg-[#f1f0eb] px-3 py-1 text-xs font-semibold text-[#68776d]">
            {olderCompletions.length}
          </span>
        </div>
        {olderCompletions.length ? (
          <details className="mt-2 border-t border-[#edf0e9] pt-2">
            <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-[#285943] hover:text-[#1d4533]">
              Show older completions ({olderCompletions.length})
            </summary>
            <ul className="divide-y divide-[#edf0e9]">
              {olderCompletions.map((completion, index) => (
                <li
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                  key={`${completion.taskId}-${completion.completedAt}-${index}`}
                >
                  <span className="min-w-0 truncate text-[#46574b]">
                    ✓ {completion.title}
                  </span>
                  <span className="shrink-0 text-xs text-[#7b857d]">
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
          <p className="mt-3 text-sm text-[#68776d]">
            No older completions.
          </p>
        )}
      </section>

      <section
        className="mt-7 rounded-2xl border border-[#eadfca] bg-white p-4 sm:p-5"
        aria-labelledby="points-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#99743a]">
              Small wins add up
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#293a30]" id="points-title">
              <span className="mr-1 text-[#c09239]" aria-hidden="true">★</span>
              Good Deeds Club
            </h2>
            <p className="mt-1 text-xs text-[#7b857d]">
              Every helpful moment deserves a little recognition.
            </p>
          </div>
          <div className="flex rounded-full border border-[#eadfca] bg-[#fbf8f1] p-1" role="group" aria-label="Scoreboard period">
            {(["week", "all"] as const).map((range) => (
              <button
                className={`min-h-9 rounded-full px-3 text-sm font-semibold ${
                  scoreRange === range
                    ? "bg-[#f0e5c9] text-[#634d25]"
                    : "text-[#746b59] hover:bg-white"
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
                  className="flex items-center gap-2 rounded-xl border border-[#efe5d2] bg-[#fbf8f1] px-3 py-2 text-sm"
                  key={assignee}
                >
                  <span className="text-[#c09239]" aria-hidden="true">
                    {points === topScore ? "★" : "✦"}
                  </span>
                  <span className="font-semibold text-[#46574b]">{assignee}</span>
                  <span className="font-bold text-[#80622d]">
                    {points} {points === 1 ? "pt" : "pts"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#746b59]">
              The first good deed earns the first star.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
