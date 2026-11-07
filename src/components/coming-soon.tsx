export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-36 pt-8 sm:px-8 lg:pb-12">
      <p className="text-sm font-medium text-brand">Your health, your pace</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      <section className="mt-7 rounded-3xl border border-line bg-card p-6 sm:p-8">
        <p className="max-w-xl leading-7 text-muted">{description}</p>
        <p className="mt-4 text-sm text-muted">
          Use the quick log to add water or weight.
        </p>
      </section>
    </main>
  );
}
