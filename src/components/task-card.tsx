"use client";

import { useEffect, useState, type FormEvent } from "react";
import type {
  Task,
  TaskPoints,
  TaskRepeat,
  TaskStatus,
} from "../../lib/tasks";

type TaskCardProps = {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
};

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function roomEmoji(room: string): string {
  const name = room.toLowerCase();
  if (name.includes("kitchen")) return "🍳";
  if (name.includes("bed")) return "🛏️";
  if (name.includes("bath")) return "🫧";
  if (name.includes("living")) return "🛋️";
  if (name.includes("garden") || name.includes("yard")) return "🌱";
  if (name.includes("laundry")) return "🧺";
  if (name.includes("garage")) return "🧰";
  return "📍";
}

function dueLabel(due: string, today: string, overdue: boolean): string {
  if (overdue) return "Overdue";
  if (due === today) return "Today";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (due === localDateString(tomorrow)) return "Tomorrow";

  return new Date(`${due}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function nextOccurrence(task: Task): string | undefined {
  return task.repeat ? task.due : undefined;
}

export default function TaskCard({
  task,
  onStatusChange,
  onDelete,
}: TaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [savedTask, setSavedTask] = useState<Task | null>(null);
  const [title, setTitle] = useState(task.title);
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [room, setRoom] = useState(task.room ?? "");
  const [due, setDue] = useState(task.due ?? "");
  const [repeat, setRepeat] = useState<TaskRepeat | "">(task.repeat ?? "");
  const [points, setPoints] = useState<TaskPoints>(task.points ?? 1);
  const displayedTask = savedTask ?? task;
  const today = localDateString(new Date());
  const overdue =
    displayedTask.due !== undefined &&
    displayedTask.status !== "done" &&
    displayedTask.due < today;
  useEffect(() => {
    setSavedTask(null);
  }, [task]);

  function startEditing() {
    setTitle(displayedTask.title);
    setAssignee(displayedTask.assignee ?? "");
    setRoom(displayedTask.room ?? "");
    setDue(displayedTask.due ?? "");
    setRepeat(displayedTask.repeat ?? "");
    setPoints(displayedTask.points ?? 1);
    setEditError("");
    setConfirmDelete(false);
    setEditing(true);
  }

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setEditError("");
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          assignee,
          room,
          due,
          repeat,
          points,
        }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(result?.error ?? "Could not save task changes.");
      }
      setSavedTask((await response.json()) as Task);
      setEditing(false);
    } catch (cause) {
      setEditError(
        cause instanceof Error ? cause.message : "Could not save task changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="relative rounded-xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {editing ? (
        <form className="space-y-3 p-4" onSubmit={saveChanges}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Task</span>
            <input
              className="min-h-11 w-full rounded-lg border border-emerald-200 px-3 text-base"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1 block text-sm font-medium">Who</span>
              <input
                className="min-h-11 w-full rounded-lg border border-sky-200 px-3 text-base"
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                maxLength={80}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">Room</span>
              <input
                className="min-h-11 w-full rounded-lg border border-teal-200 px-3 text-base"
                value={room}
                onChange={(event) => setRoom(event.target.value)}
                maxLength={80}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">Due date</span>
              <input
                className="min-h-11 w-full rounded-lg border border-orange-200 px-2 text-base"
                type="date"
                value={due}
                onChange={(event) => setDue(event.target.value)}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">Repeat</span>
              <select
                className="min-h-11 w-full rounded-lg border border-emerald-200 bg-white px-2 text-base"
                value={repeat}
                onChange={(event) =>
                  setRepeat(event.target.value as TaskRepeat | "")
                }
              >
                <option value="">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Points</span>
            <select
              className="min-h-11 w-full rounded-lg border border-violet-200 bg-white px-3 text-base"
              value={points}
              onChange={(event) =>
                setPoints(Number(event.target.value) as TaskPoints)
              }
            >
              <option value={1}>1 point · Easy</option>
              <option value={3}>3 points · Medium</option>
              <option value={5}>5 points · Hard</option>
            </select>
          </label>
          {editError && (
            <p className="text-sm text-rose-700" role="alert">
              {editError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              className="min-h-11 flex-1 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              className="min-h-11 rounded-lg border border-stone-300 px-3 text-sm font-medium"
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="p-4 pb-2">
            <h3 className="break-words text-base font-bold leading-snug text-stone-900">
              {displayedTask.title}
            </h3>
            <div className="mt-1 flex items-start justify-between gap-2">
              <div className="min-w-0 text-sm text-stone-600">
                <p className="truncate">{displayedTask.assignee ?? "Anyone"}</p>
                {displayedTask.room && (
                  <p className="truncate text-xs text-stone-500">
                    {roomEmoji(displayedTask.room)} {displayedTask.room}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
              <span
                className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900"
                aria-label={`${displayedTask.points ?? 1} task points`}
                title="Earn these points when you finish the task"
              >
                +{displayedTask.points ?? 1}{" "}
                {(displayedTask.points ?? 1) === 1 ? "pt" : "pts"}
              </span>
              <details className="group relative">
                <summary
                  className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-lg text-lg text-stone-600 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
                  aria-label={`More options for ${displayedTask.title}`}
                >
                  ⋯
                </summary>
                <div className="absolute right-0 top-10 z-10 w-40 rounded-xl border border-stone-200 bg-white p-1 shadow-lg">
                  <button
                    className="min-h-11 w-full rounded-lg px-3 text-left text-sm font-medium hover:bg-stone-100"
                    type="button"
                    onClick={startEditing}
                  >
                    Edit task
                  </button>
                  {confirmDelete ? (
                    <>
                      <p className="px-3 py-2 text-xs text-stone-600">
                        Delete this task?
                      </p>
                      <button
                        className="min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
                        type="button"
                        onClick={() => onDelete(task.id)}
                      >
                        Confirm delete
                      </button>
                      <button
                        className="min-h-11 w-full rounded-lg px-3 text-left text-sm text-stone-700 hover:bg-stone-100"
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Keep task
                      </button>
                    </>
                  ) : (
                    <button
                      className="min-h-11 w-full rounded-lg px-3 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete task
                    </button>
                  )}
                </div>
              </details>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 pb-3 text-xs">
            {(displayedTask.due ||
              (displayedTask.repeat && displayedTask.status === "done")) && (
              <span
                className={`rounded-full px-2.5 py-1 font-semibold ${
                  overdue
                    ? "bg-rose-50 text-rose-700"
                    : "bg-stone-100 text-stone-700"
                }`}
              >
                {displayedTask.repeat && displayedTask.status === "done"
                  ? `Completed ${
                      displayedTask.completionHistory?.at(-1)?.completedOn === today
                        ? "today"
                        : displayedTask.completionHistory?.at(-1)?.completedOn
                          ? dueLabel(
                              displayedTask.completionHistory.at(-1)!.completedOn,
                              today,
                              false,
                            ).toLowerCase()
                          : "recently"
                    }. Next ${
                      nextOccurrence(displayedTask)
                        ? dueLabel(
                            nextOccurrence(displayedTask)!,
                            today,
                            false,
                          ).toLowerCase()
                        : "soon"
                    }`
                  : `${overdue ? "Overdue · " : ""}${dueLabel(
                      displayedTask.due ?? today,
                      today,
                      overdue,
                    )}`}
              </span>
            )}
            {displayedTask.repeat && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
                Repeats {displayedTask.repeat}
              </span>
            )}
            {displayedTask.room && (
              <span className="text-stone-500">
                {roomEmoji(displayedTask.room)}
              </span>
            )}
          </div>
          <div className="border-t border-stone-100 px-4 py-3">
            {displayedTask.status === "todo" ? (
              <button
                className="min-h-11 w-full rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white hover:bg-emerald-800"
                type="button"
                onClick={() => onStatusChange(task.id, "doing")}
              >
                Start task
              </button>
            ) : displayedTask.status === "doing" ? (
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <button
                  className="min-h-11 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white hover:bg-emerald-800"
                  type="button"
                  onClick={() => onStatusChange(task.id, "done")}
                >
                  Mark done ✓
                </button>
                <button
                  className="min-h-11 rounded-lg px-3 text-sm font-semibold text-stone-600 hover:bg-stone-100"
                  type="button"
                  onClick={() => onStatusChange(task.id, "todo")}
                >
                  To Do
                </button>
              </div>
            ) : (
              <button
                className="min-h-9 rounded-md px-2 text-xs font-semibold text-stone-600 hover:bg-stone-100"
                type="button"
                onClick={() => onStatusChange(task.id, "todo")}
              >
                ↶ Move back to To Do
              </button>
            )}
          </div>
        </>
      )}
    </article>
  );
}
