import { signOut } from "@/lib/auth";

export default function MorePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-36 pt-8 sm:px-8 lg:pb-12">
      <p className="text-sm font-medium text-brand">Your account</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">More</h1>
      <section className="mt-7 rounded-3xl border border-line bg-card p-6">
        <h2 className="text-lg font-semibold">Privacy and support</h2>
        <p className="mt-2 text-sm text-muted">
          Your health information is personal. It is not medical advice.
        </p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
          className="mt-5"
        >
          <button
            className="min-h-11 rounded-xl border border-line px-5 font-medium"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
