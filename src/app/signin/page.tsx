import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import SignInButtons from "@/components/sign-in-buttons";

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
      <SignInButtons providers={availableProviders} />
    </main>
  );
}
