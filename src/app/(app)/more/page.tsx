import { signOut } from "@/lib/auth";
import MoreHealthPage from "@/components/more-health-page";

export default function MorePage() {
  return (
    <>
      <MoreHealthPage />
      <section className="mx-auto mb-24 max-w-6xl px-4 sm:px-8">
        <div className="rounded-3xl border border-line bg-card p-5 sm:p-7">
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
        </div>
      </section>
    </>
  );
}
