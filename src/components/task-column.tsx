"use client";

import type { Task, TaskStatus } from "../../lib/tasks";
import TaskCard from "./task-card";

const columns: { status: TaskStatus; title: string }[] = [
  { status: "todo", title: "To do" },
  { status: "doing", title: "In progress" },
  { status: "done", title: "Done" },
];

const columnColors: Record<TaskStatus, string> = {
  todo: "border-stone-200 bg-[#f1f0eb]",
  doing: "border-[#dce6db] bg-[#edf2eb]",
  done: "border-[#e8dfcb] bg-[#f4f0e7]",
};

const headingColors: Record<TaskStatus, string> = {
  todo: "text-stone-800",
  doing: "text-[#285943]",
  done: "text-[#725e34]",
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
      className={`${active ? "block" : "hidden"} min-w-0 rounded-2xl border p-3 lg:block lg:p-4 ${columnColors[status]}`}
      aria-labelledby={`column-heading-${status}`}
      role="tabpanel"
    >
      <div className="mb-4 flex items-center justify-between px-1">
        <h2
          className={`flex items-center gap-2 text-base font-bold tracking-tight ${headingColors[status]}`}
          id={`column-heading-${status}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              status === "todo"
                ? "bg-stone-400"
                : status === "doing"
                  ? "bg-[#789478]"
                  : "bg-[#c39a4a]"
            }`}
            aria-hidden="true"
          />
          {column?.title}
        </h2>
        <span className="rounded-full border border-white/80 bg-white/80 px-2.5 py-1 text-xs font-semibold text-stone-600">
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
          <div className="rounded-xl border border-dashed border-stone-300 bg-white/65 px-3 py-5 text-center">
            <p className="text-sm font-semibold text-stone-700">Nothing to do</p>
            <button
              className="mt-1 min-h-10 rounded-lg px-3 text-xs font-semibold text-[#285943] hover:bg-white"
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
