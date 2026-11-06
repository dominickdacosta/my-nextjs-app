import OnboardingForm from "./onboarding-form";
import { APP_NAME } from "@/lib/constants";

export default function OnboardingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand">
        Welcome to {APP_NAME}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Set up your health profile
      </h1>
      <p className="mt-2 text-muted">
        You can update these details and targets at any time.
      </p>
      <OnboardingForm />
    </main>
  );
}
