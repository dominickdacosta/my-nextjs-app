"use client";

import type { Task, TaskStatus } from "../../lib/tasks";
import TaskCard from "./task-card";

const columns: { status: TaskStatus; title: string }[] = [
  { status: "todo", title: "To do" },
  { status: "doing", title: "In progress" },
  { status: "done", title: "Done" },
];

const columnColors: Record<TaskStatus, string> = {
  todo: "border-sky-200 bg-sky-50/80",
  doing: "border-amber-200 bg-amber-50/80",
  done: "border-emerald-200 bg-emerald-50/80",
};

const headingColors: Record<TaskStatus, string> = {
  todo: "text-sky-950",
  doing: "text-amber-950",
  done: "text-emerald-950",
};

type TaskColumnProps = {
  status: TaskStatus;
  tasks: Task[];
  active: boolean;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onAddTask: () => void;
};

export default function TaskColumn({
  status,
  tasks,
  active,
  onStatusChange,
  onDelete,
  onAddTask,
}: TaskColumnProps) {
  const column = columns.find((item) => item.status === status);

  return (
    <section
      id={`column-${status}`}
      className={`${active ? "block" : "hidden"} min-w-0 rounded-2xl border p-3 md:block md:p-4 ${columnColors[status]}`}
      aria-labelledby={`column-heading-${status}`}
      role="tabpanel"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2
          className={`text-lg font-semibold tracking-tight ${headingColors[status]}`}
          id={`column-heading-${status}`}
        >
          {column?.title}
        </h2>
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-stone-700">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-3">
        {tasks.length ? (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-white/90 bg-white/50 px-3 py-2 text-center">
            <p className="text-sm font-semibold text-stone-700">Nothing to do</p>
            <button
              className="min-h-9 rounded-lg px-3 text-xs font-semibold text-emerald-800 hover:bg-white/80"
              type="button"
              onClick={onAddTask}
            >
              + Add a task
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
