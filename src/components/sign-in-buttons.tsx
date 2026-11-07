"use client";

import { useEffect, useState } from "react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { signIn } from "next-auth/react";

type SignInProvider = {
  id: string;
  label: string;
};

export default function SignInButtons({
  providers,
}: {
  providers: SignInProvider[];
}) {
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const mobileAuthError = window.sessionStorage.getItem("vitals.auth.error");
    if (mobileAuthError) {
      window.sessionStorage.removeItem("vitals.auth.error");
      setError(mobileAuthError);
      setPendingProvider(null);
    }
    const resetPending = () => setPendingProvider(null);
    window.addEventListener("vitals-auth-browser-finished", resetPending);
    return () =>
      window.removeEventListener("vitals-auth-browser-finished", resetPending);
  }, []);

  async function startAndroidGoogleSignIn() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const handoff = btoa(String.fromCharCode(...bytes))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
    window.sessionStorage.setItem("vitals.auth.handoff", handoff);
    const authUrl = new URL("/mobile-auth/start", window.location.origin);
    authUrl.searchParams.set("handoff", handoff);
    await Browser.open({ url: authUrl.toString() });
  }

  async function continueWith(provider: SignInProvider) {
    setPendingProvider(provider.id);
    setError("");
    try {
      if (
        provider.id === "google" &&
        Capacitor.isNativePlatform() &&
        Capacitor.getPlatform() === "android"
      ) {
        await startAndroidGoogleSignIn();
        return;
      }
      await signIn(provider.id, { redirectTo: "/" });
    } catch {
      setPendingProvider(null);
      setError("Sign-in could not be started. Please try again.");
    }
  }

  return (
    <div className="mt-8 grid gap-3">
      {providers.map((provider) => (
        <button
          className="min-h-11 w-full rounded-xl border border-line bg-card px-4 font-medium disabled:opacity-60"
          disabled={pendingProvider !== null}
          key={provider.id}
          onClick={() => void continueWith(provider)}
          type="button"
        >
          {pendingProvider === provider.id
            ? "Opening sign-in..."
            : provider.label}
        </button>
      ))}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {providers.length === 0 ? (
        <p className="rounded-2xl border border-line p-4 text-sm text-muted">
          Sign-in is not configured yet. Add a GitHub, Google, or Resend
          provider to the environment before enabling accounts.
        </p>
      ) : null}
    </div>
  );
}
