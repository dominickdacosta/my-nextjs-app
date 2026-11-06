import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

const focusAreas = [
  { icon: "🥗", title: "Nutrition", detail: "Food, protein and hydration" },
  { icon: "🏃", title: "Movement", detail: "Workouts, walks and activity" },
  { icon: "🌙", title: "Recovery", detail: "Sleep, mood and well-being" },
];

export default function Home() {
  const isPreview = process.env.VERCEL_ENV === "preview";

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link className="flex items-center gap-3 font-semibold" href="/">
            <span className="grid size-10 place-items-center rounded-2xl bg-brand text-white">
              V
            </span>
            <span>{APP_NAME}</span>
          </Link>
          {isPreview ? (
            <span className="rounded-full border border-line px-3 py-1 text-sm text-muted">
              Preview
            </span>
          ) : null}
        </header>

        <section className="py-16 sm:py-24">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand">
            Your health, made personal
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
            A clearer picture of how you feel.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
            Keep everyday health notes together: what you eat, how you move,
            and how well you rest.
          </p>
          <p className="mt-8 inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-medium text-white">
            Your daily health companion
          </p>
        </section>

        <section aria-label="Health tracking areas" className="grid gap-4 sm:grid-cols-3">
          {focusAreas.map((area) => (
            <article
              className="rounded-3xl border border-line bg-card p-6"
              key={area.title}
            >
              <span aria-hidden="true" className="text-2xl">
                {area.icon}
              </span>
              <h2 className="mt-5 text-lg font-semibold">{area.title}</h2>
              <p className="mt-2 text-sm text-muted">{area.detail}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
