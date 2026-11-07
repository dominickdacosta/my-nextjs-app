"use client";

import { useEffect, useState } from "react";

export default function MobileGoogleSignInStart() {
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function startSignIn() {
      const handoff = new URLSearchParams(window.location.search).get("handoff");
      if (!handoff || !/^[A-Za-z0-9_-]{43}$/.test(handoff)) {
        setError("This sign-in request is invalid. Return to Vitals and try again.");
        return;
      }

      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "include",
      });
      if (!csrfResponse.ok) {
        throw new Error("Could not start Google sign-in.");
      }
      const { csrfToken } = (await csrfResponse.json()) as {
        csrfToken?: string;
      };
      if (!csrfToken) throw new Error("Could not start Google sign-in.");

      const callbackUrl = new URL(
        "/api/mobile-auth/complete",
        window.location.origin,
      );
      callbackUrl.searchParams.set("handoff", handoff);
      const form = new URLSearchParams({
        csrfToken,
        callbackUrl: callbackUrl.toString(),
      });
      const signInResponse = await fetch("/api/auth/signin/google", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Auth-Return-Redirect": "1",
        },
        body: form,
      });
      if (!signInResponse.ok) {
        throw new Error("Could not start Google sign-in.");
      }
      const result = (await signInResponse.json()) as { url?: string };
      if (!result.url) throw new Error("Could not start Google sign-in.");
      window.location.replace(result.url);
    }

    void startSignIn().catch(() => {
      if (active) setError("Could not start Google sign-in. Return to Vitals and try again.");
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
      <p className="text-center text-sm text-muted" role={error ? "alert" : "status"}>
        {error || "Connecting securely to Google..."}
      </p>
    </main>
  );
}
