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
    <article className="relative rounded-2xl border border-[#e5e7df] bg-white shadow-[0_1px_2px_rgba(36,53,44,0.04)] transition-all hover:-translate-y-0.5 hover:border-[#cbd8cc] hover:shadow-[0_8px_24px_rgba(36,53,44,0.08)]">
      {editing ? (
        <form className="space-y-3 p-4" onSubmit={saveChanges}>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#46574b]">Task</span>
            <input
              className="min-h-11 w-full rounded-xl border border-[#dfe4dc] bg-[#fbfbf9] px-3 text-base"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1 block text-sm font-semibold text-[#46574b]">Who</span>
              <input
                className="min-h-11 w-full rounded-xl border border-[#dfe4dc] bg-[#fbfbf9] px-3 text-base"
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                maxLength={80}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold text-[#46574b]">Room</span>
              <input
                className="min-h-11 w-full rounded-xl border border-[#dfe4dc] bg-[#fbfbf9] px-3 text-base"
                value={room}
                onChange={(event) => setRoom(event.target.value)}
                maxLength={80}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold text-[#46574b]">Due date</span>
              <input
                className="min-h-11 w-full rounded-xl border border-[#dfe4dc] bg-[#fbfbf9] px-2 text-base"
                type="date"
                value={due}
                onChange={(event) => setDue(event.target.value)}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold text-[#46574b]">Repeat</span>
              <select
                className="min-h-11 w-full rounded-xl border border-[#dfe4dc] bg-[#fbfbf9] px-2 text-base"
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
            <span className="mb-1 block text-sm font-semibold text-[#46574b]">Points</span>
            <select
              className="min-h-11 w-full rounded-xl border border-[#dfe4dc] bg-[#fbfbf9] px-3 text-base"
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
            <p className="text-sm text-[#9b493c]" role="alert">
              {editError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              className="min-h-11 flex-1 rounded-xl bg-[#285943] px-3 text-sm font-semibold text-white hover:bg-[#1d4533] disabled:opacity-60"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              className="min-h-11 rounded-xl border border-[#dfe4dc] px-3 text-sm font-medium text-[#526156] hover:bg-[#f7f7f3]"
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
            <h3 className="break-words text-[15px] font-bold leading-snug text-[#293a30]">
              {displayedTask.title}
            </h3>
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0 text-sm text-[#526156]">
                <p className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e5eee6] text-[11px] font-bold text-[#285943]" aria-hidden="true">
                    {displayedTask.assignee?.slice(0, 1).toUpperCase() ?? "•"}
                  </span>
                  <span className="truncate">{displayedTask.assignee ?? "Anyone"}</span>
                </p>
                {displayedTask.room && (
                  <p className="mt-1 truncate pl-9 text-xs text-[#7b857d]">
                    {roomEmoji(displayedTask.room)} {displayedTask.room}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
              <span
                className="rounded-full bg-[#f7f0df] px-2.5 py-1 text-xs font-bold text-[#80622d]"
                aria-label={`${displayedTask.points ?? 1} task points`}
                title="Earn these points when you finish the task"
              >
                +{displayedTask.points ?? 1}{" "}
                {(displayedTask.points ?? 1) === 1 ? "pt" : "pts"}
              </span>
              <details className="group relative">
                <summary
                  className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-xl text-lg text-[#68776d] hover:bg-[#f1f3ed]"
                  aria-label={`More options for ${displayedTask.title}`}
                >
                  ⋯
                </summary>
                <div className="absolute right-0 top-10 z-10 w-40 rounded-xl border border-[#e5e7df] bg-white p-1 shadow-lg">
                  <button
                    className="min-h-11 w-full rounded-lg px-3 text-left text-sm font-medium text-[#46574b] hover:bg-[#f7f7f3]"
                    type="button"
                    onClick={startEditing}
                  >
                    Edit task
                  </button>
                  {confirmDelete ? (
                    <>
                      <p className="px-3 py-2 text-xs text-[#68776d]">
                        Delete this task?
                      </p>
                      <button
                        className="min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold text-[#9b493c] hover:bg-[#fff4f1]"
                        type="button"
                        onClick={() => onDelete(task.id)}
                      >
                        Confirm delete
                      </button>
                      <button
                        className="min-h-11 w-full rounded-lg px-3 text-left text-sm text-[#526156] hover:bg-[#f7f7f3]"
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Keep task
                      </button>
                    </>
                  ) : (
                    <button
                      className="min-h-11 w-full rounded-lg px-3 text-left text-sm font-medium text-[#9b493c] hover:bg-[#fff4f1]"
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
          <div className="border-t border-[#f0f1ec] px-4 py-3">
            {displayedTask.status === "todo" ? (
              <button
                className="min-h-11 w-full rounded-xl bg-[#285943] px-3 text-sm font-bold text-white hover:bg-[#1d4533]"
                type="button"
                onClick={() => onStatusChange(task.id, "doing")}
              >
                Start task
              </button>
            ) : displayedTask.status === "doing" ? (
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <button
                  className="min-h-11 rounded-xl bg-[#285943] px-3 text-sm font-bold text-white hover:bg-[#1d4533]"
                  type="button"
                  onClick={() => onStatusChange(task.id, "done")}
                >
                  Mark done ✓
                </button>
                <button
                  className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[#68776d] hover:bg-[#f1f3ed]"
                  type="button"
                  onClick={() => onStatusChange(task.id, "todo")}
                >
                  To Do
                </button>
              </div>
            ) : (
              <button
                className="min-h-9 rounded-lg px-2 text-xs font-semibold text-[#68776d] hover:bg-[#f1f3ed]"
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
