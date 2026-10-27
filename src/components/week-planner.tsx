"use client";

import type { Task, TaskStatus } from "../../lib/tasks";
import TaskCard from "./task-card";

export type PlannerDay = {
  date: string;
  label: string;
  isToday: boolean;
  tasks: Task[];
};

type WeekPlannerProps = {
  days: PlannerDay[];
  weekLabel: string;
  isCurrentWeek: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onAddTask: () => void;
};

export default function WeekPlanner({
  days,
  weekLabel,
  isCurrentWeek,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
  onStatusChange,
  onDelete,
  onAddTask,
}: WeekPlannerProps) {
  return (
    <section
      className="mt-5"
      aria-labelledby="week-planner-title"
      aria-live="polite"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#718074]">
            Plan ahead
          </p>
          <h3
            className="mt-1 text-lg font-bold text-[#293a30]"
            id="week-planner-title"
          >
            {weekLabel}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="min-h-10 min-w-10 rounded-full border border-[#dfe4dc] bg-white text-lg text-[#526156] hover:bg-[#f1f3ed]"
            type="button"
            onClick={onPreviousWeek}
            aria-label="Previous week"
          >
            ‹
          </button>
          <button
            className="min-h-10 rounded-full border border-[#dfe4dc] bg-white px-3 text-sm font-semibold text-[#526156] hover:bg-[#f1f3ed] disabled:cursor-default disabled:opacity-50"
            type="button"
            onClick={onCurrentWeek}
            disabled={isCurrentWeek}
          >
            This week
          </button>
          <button
            className="min-h-10 min-w-10 rounded-full border border-[#dfe4dc] bg-white text-lg text-[#526156] hover:bg-[#f1f3ed]"
            type="button"
            onClick={onNextWeek}
            aria-label="Next week"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {days.map((day) => (
          <section
            className={`min-w-0 rounded-2xl border p-3 ${
              day.isToday
                ? "border-[#9db7a1] bg-[#edf3ec]"
                : "border-[#e5e7df] bg-white"
            }`}
            key={day.date}
            aria-labelledby={`week-day-${day.date}`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4
                className="text-sm font-bold text-[#293a30]"
                id={`week-day-${day.date}`}
              >
                {day.label}
              </h4>
              {day.isToday && (
                <span className="rounded-full bg-[#285943] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Today
                </span>
              )}
              <span className="ml-auto rounded-full bg-[#f1f0eb] px-2 py-0.5 text-xs font-semibold text-[#68776d]">
                {day.tasks.length}
              </span>
            </div>

            {day.tasks.length ? (
              <div className="space-y-2">
                {day.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[#dfe4dc] px-3 py-4 text-center text-xs text-[#7b857d]">
                Nothing planned
              </p>
            )}
          </section>
        ))}
      </div>

      <button
        className="mt-4 min-h-11 rounded-xl border border-[#dfe4dc] bg-white px-4 text-sm font-semibold text-[#285943] hover:bg-[#f1f3ed]"
        type="button"
        onClick={onAddTask}
      >
        + Add a task
      </button>
    </section>
  );
}
