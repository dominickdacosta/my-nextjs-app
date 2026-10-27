type DailyOverviewProps = {
  headline: string;
  message: string;
  completed: number;
  remaining: number;
  overdue: number;
  dueToday: number;
  progress: number;
  scopeLabel: string;
};

const metrics = [
  { key: "completed", label: "Completed today", color: "text-[#285943]" },
  { key: "remaining", label: "Still to do", color: "text-[#526156]" },
  { key: "overdue", label: "Overdue", color: "text-[#a45143]" },
] as const;

export default function DailyOverview({
  headline,
  message,
  completed,
  remaining,
  overdue,
  dueToday,
  progress,
  scopeLabel,
}: DailyOverviewProps) {
  const values = { completed, remaining, overdue };

  return (
    <section
      className="mb-7 overflow-hidden rounded-3xl border border-[#dfe8df] bg-[#e5eee6] p-5 sm:p-7"
      aria-labelledby="daily-overview-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#54745b]">
            {scopeLabel} · Daily overview
          </p>
          <h2
            className="mt-2 text-2xl font-bold tracking-tight text-[#23382c] sm:text-3xl"
            id="daily-overview-title"
          >
            {headline}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#526156]">{message}</p>
        </div>
        <div className="min-w-40 rounded-2xl border border-white/80 bg-white/80 px-4 py-3">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-semibold text-[#526156]">
              Today&apos;s progress
            </span>
            <span className="text-lg font-bold tabular-nums text-[#285943]">
              {progress}%
            </span>
          </div>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#e7ece5]"
            role="progressbar"
            aria-label="Today's tasks completed"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full rounded-full bg-[#588263] transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-[#718074]">
            {dueToday === 0
              ? "No tasks due today"
              : `${dueToday - remaining} of ${dueToday} due tasks`}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/75 px-4 py-3"
            key={metric.key}
          >
            <dt className="text-sm font-medium text-[#526156]">
              {metric.label}
            </dt>
            <dd
              className={`text-2xl font-bold tabular-nums ${metric.color}`}
              aria-label={`${metric.label}: ${values[metric.key]}`}
            >
              {values[metric.key]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
