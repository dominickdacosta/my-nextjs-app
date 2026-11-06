import { signIn } from "@/lib/auth";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

const availableProviders = [
  process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
    ? { id: "github", label: "Continue with GitHub" }
    : null,
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? { id: "google", label: "Continue with Google" }
    : null,
  process.env.AUTH_RESEND_KEY
    ? { id: "resend", label: "Continue with email" }
    : null,
].filter((provider) => provider !== null);

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
      <Link className="text-sm font-semibold text-brand" href="/">
        {APP_NAME}
      </Link>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-3 text-muted">
        Your health information is private to your account.
      </p>
      <div className="mt-8 grid gap-3">
        {availableProviders.map((provider) => (
          <form
            action={async () => {
              "use server";
              await signIn(provider.id, { redirectTo: "/" });
            }}
            key={provider.id}
          >
            <button
              className="min-h-11 w-full rounded-xl border border-line bg-card px-4 font-medium"
              type="submit"
            >
              {provider.label}
            </button>
          </form>
        ))}
        {availableProviders.length === 0 ? (
          <p className="rounded-2xl border border-line p-4 text-sm text-muted">
            Sign-in is not configured yet. Add a GitHub, Google, or Resend
            provider to the environment before enabling accounts.
          </p>
        ) : null}
      </div>
    </main>
  );
}
