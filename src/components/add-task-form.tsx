"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { TaskPoints, TaskRepeat } from "../../lib/tasks";

const householdChores = [
  "Have breakfast",
  "Do the dishes",
  "Help with laundry",
  "Studies/homework",
  "Help in the kitchen",
  "Help with cleaning",
  "Go to sleep",
  "Go for mass",
  "Prayers",
];

const unassignedChoice = "__unassigned__";
const newPersonChoice = "__new_person__";
const chorePresets = [
  {
    label: "Bedtime · Alvaro",
    title: "Go to sleep",
    assignee: "Alvaro",
    room: "Bedroom",
    points: 1,
    repeat: "daily",
  },
  {
    label: "Bedtime · Damien",
    title: "Go to sleep",
    assignee: "Damien",
    room: "Bedroom",
    points: 1,
    repeat: "daily",
  },
  {
    label: "Dishes",
    title: "Do the dishes",
    assignee: "",
    room: "Kitchen",
    points: 3,
    repeat: "daily",
  },
  {
    label: "Homework",
    title: "Studies/homework",
    assignee: "",
    room: "Study",
    points: 3,
    repeat: "daily",
  },
] as const;

type AddTaskFormProps = {
  assignees: string[];
  openSignal?: number;
  onCreate: (task: TaskDraft | TaskDraft[]) => Promise<void>;
};

type TaskDraft = {
    title: string;
    status: "todo";
    points: TaskPoints;
    assignee?: string;
    room?: string;
    due?: string;
    repeat?: TaskRepeat;
};

export default function AddTaskForm({
  assignees,
  onCreate,
  openSignal = 0,
}: AddTaskFormProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [taskChoice, setTaskChoice] = useState(householdChores[0]);
  const [customTitle, setCustomTitle] = useState("");
  const [personChoice, setPersonChoice] = useState(unassignedChoice);
  const [room, setRoom] = useState("");
  const [due, setDue] = useState("");
  const [repeat, setRepeat] = useState<TaskRepeat | "">("");
  const [points, setPoints] = useState<TaskPoints>(1);
  const [customMode, setCustomMode] = useState(false);
  const [assignBothKids, setAssignBothKids] = useState(false);
  const availableAssignees = [
    ...new Set([
      ...assignees,
      ...chorePresets.map((preset) => preset.assignee).filter(Boolean),
    ]),
  ].sort((first, second) => first.localeCompare(second));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;

    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  function closeDialog() {
    setOpen(false);
    setError("");
    setTaskChoice(householdChores[0]);
    setCustomTitle("");
    setPersonChoice(unassignedChoice);
    setRoom("");
    setDue("");
    setRepeat("");
    setPoints(1);
    setCustomMode(false);
    setAssignBothKids(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    const form = event.currentTarget;
    const values = new FormData(form);
    const title = customMode ? customTitle.trim() : taskChoice.trim();
    const assignee =
      personChoice === newPersonChoice
        ? String(values.get("newPerson") ?? "").trim()
        : personChoice === unassignedChoice
          ? ""
          : personChoice;

    if (!title) {
      setError("Enter a task name.");
      setSaving(false);
      return;
    }

    if (!assignBothKids && personChoice === newPersonChoice && !assignee) {
      setError("Enter a name, or choose Unassigned.");
      setSaving(false);
      return;
    }

    const nextDue =
      due || (repeat ? localDateString(new Date()) : undefined);

    try {
      const draft: TaskDraft = {
        title,
        status: "todo",
        points,
        room: room.trim() || undefined,
        due: nextDue,
        repeat: repeat || undefined,
      };
      if (assignBothKids) {
        await onCreate([
          { ...draft, assignee: "Alvaro" },
          { ...draft, assignee: "Damien" },
        ]);
      } else {
        await onCreate({ ...draft, assignee: assignee || undefined });
      }
      form.reset();
      closeDialog();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        className="min-h-12 w-full rounded-2xl bg-emerald-700 px-5 text-base font-bold text-white shadow-md shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-emerald-800 sm:w-auto"
        type="button"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">＋ </span>Add a task
      </button>

      {open && (
        <dialog
          ref={dialog}
          className="m-0 max-h-full w-full max-w-none bg-transparent p-0 backdrop:bg-stone-950/50 sm:fixed sm:inset-0 sm:m-auto sm:w-[min(100%-2rem,32rem)]"
          aria-labelledby="add-task-title"
          onCancel={(event) => {
            event.preventDefault();
            closeDialog();
          }}
        >
          <form
            className="max-h-[90dvh] space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
            onSubmit={submit}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">
                  New household chore
                </p>
                <h2
                  className="mt-1 text-2xl font-bold tracking-tight text-emerald-950"
                  id="add-task-title"
                >
                  Add a task
                </h2>
              </div>
              <button
                className="grid min-h-11 min-w-11 place-items-center rounded-full bg-stone-100 text-xl text-stone-700 hover:bg-stone-200"
                type="button"
                onClick={closeDialog}
                aria-label="Close add task"
              >
                ×
              </button>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-stone-800">
                {customMode ? "Custom task" : "Search or choose a chore"}
              </span>
              <input
                className="min-h-12 w-full rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 text-base"
                list={customMode ? undefined : "household-chores"}
                placeholder={customMode ? "What needs doing?" : "Search household chores…"}
                value={customMode ? customTitle : taskChoice}
                onChange={(event) => {
                  const value = event.target.value;
                  if (customMode) {
                    setCustomTitle(value);
                    return;
                  }
                  const preset = chorePresets.find((item) => item.label === value);
                  if (preset) {
                    setTaskChoice(preset.title);
                    setPersonChoice(preset.assignee || unassignedChoice);
                    setRoom(preset.room);
                    setPoints(preset.points);
                    setRepeat(preset.repeat);
                    setDue(localDateString(new Date()));
                    setAssignBothKids(false);
                    return;
                  }
                  setTaskChoice(value);
                  if (value !== taskChoice) {
                    setRoom("");
                    setRepeat("");
                    setDue("");
                    setPoints(1);
                  }
                }}
                maxLength={160}
                required
              />
              {!customMode && (
                <datalist id="household-chores">
                  {[...householdChores, ...chorePresets.map((preset) => preset.label)]
                    .filter((chore, index, all) => all.indexOf(chore) === index)
                    .map((chore) => (
                      <option key={chore} value={chore} />
                    ))}
                </datalist>
              )}
              <button
                className="mt-1 min-h-9 text-sm font-semibold text-emerald-800 underline-offset-2 hover:underline"
                type="button"
                onClick={() => {
                  setCustomMode(!customMode);
                  setTaskChoice(householdChores[0]);
                  setCustomTitle("");
                  setRoom("");
                  setDue("");
                  setRepeat("");
                  setPoints(1);
                  setPersonChoice(unassignedChoice);
                }}
              >
                {customMode ? "Choose a chore instead" : "＋ Create a custom task"}
              </button>
            </label>

            {!assignBothKids && <label className="block">
              <span className="mb-1 block text-sm font-semibold text-stone-800">
                Who’s doing it?
              </span>
              <select
                className="min-h-12 w-full rounded-xl border border-sky-200 bg-sky-50/50 px-3 text-base"
                value={personChoice}
                onChange={(event) => setPersonChoice(event.target.value)}
              >
                <option value={unassignedChoice}>🤝 Unassigned</option>
                {availableAssignees.map((assignee) => (
                  <option key={assignee} value={assignee}>
                    {assignee}
                  </option>
                ))}
                <option value={newPersonChoice}>＋ Add a person…</option>
              </select>
            </label>}

            {!assignBothKids && personChoice === newPersonChoice && (
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-stone-800">
                  Person’s name
                </span>
                <input
                  autoFocus
                  className="min-h-12 w-full rounded-xl border border-sky-200 px-3 text-base"
                  name="newPerson"
                  type="text"
                  placeholder="Enter a name"
                  maxLength={80}
                  required
                />
              </label>
            )}

            <label className="flex min-h-11 items-center gap-3 rounded-xl bg-sky-50 px-3 text-sm font-semibold text-sky-950">
              <input
                className="h-5 w-5 accent-emerald-700"
                type="checkbox"
                checked={assignBothKids}
                onChange={(event) => setAssignBothKids(event.target.checked)}
              />
              Assign separate copies to Alvaro and Damien
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1 block text-sm font-semibold text-stone-800">
                  Due date
                </span>
                <input
                  className="min-h-12 w-full rounded-xl border border-orange-200 px-2 text-base"
                  name="due"
                  type="date"
                  value={due}
                  onChange={(event) => setDue(event.target.value)}
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold text-stone-800">
                  Room
                </span>
                <input
                  className="min-h-12 w-full rounded-xl border border-teal-200 px-3 text-base"
                  value={room}
                  onChange={(event) => setRoom(event.target.value)}
                  maxLength={80}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1 block text-sm font-semibold text-stone-800">
                  Repeat
                </span>
                <select
                  className="min-h-12 w-full rounded-xl border border-emerald-200 bg-white px-2 text-base"
                  name="repeat"
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
              <span className="mb-1 block text-sm font-semibold text-stone-800">
                How much of a challenge?
              </span>
              <select
                className="min-h-12 w-full rounded-xl border border-violet-200 bg-violet-50/50 px-3 text-base"
                name="points"
                value={points}
                onChange={(event) =>
                  setPoints(Number(event.target.value) as TaskPoints)
                }
              >
                <option value="1">⭐ Easy · 1 point</option>
                <option value="3">⭐⭐ Medium · 3 points</option>
                <option value="5">⭐⭐⭐ Big challenge · 5 points</option>
              </select>
            </label>

            {error && (
              <p className="text-sm text-rose-700" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                className="min-h-12 flex-1 rounded-xl bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
                type="submit"
                disabled={saving}
              >
                {saving ? "Adding…" : "Add task"}
              </button>
              <button
                className="min-h-12 rounded-xl border border-stone-300 px-4 font-semibold text-stone-700 hover:bg-stone-50"
                type="button"
                onClick={closeDialog}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
