"use client";

import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

export default function MobileAuthHandoff() {
  const processingHandoff = useRef(false);

  useEffect(() => {
    if (
      !Capacitor.isNativePlatform() ||
      Capacitor.getPlatform() !== "android"
    ) {
      return;
    }

    let active = true;
    let removeUrlListener: (() => void) | undefined;
    let removeBrowserListener: (() => void) | undefined;
    const completeSignIn = async (url: string) => {
      let callback: URL;
      try {
        callback = new URL(url);
      } catch {
        return;
      }
      if (
        callback.protocol !== "com.vitals.health:" ||
        callback.hostname !== "auth" ||
        callback.pathname !== "/callback"
      ) {
        return;
      }

      const handoff = callback.searchParams.get("handoff");
      if (
        !handoff ||
        handoff !== window.sessionStorage.getItem("vitals.auth.handoff") ||
        processingHandoff.current
      ) {
        return;
      }
      processingHandoff.current = true;
      try {
        const callbackError = callback.searchParams.get("error");
        if (callbackError) {
          throw new Error("Google sign-in did not complete. Please try again.");
        }
        const code = callback.searchParams.get("code");
        if (!code) throw new Error("Google sign-in returned no handoff code.");

        const response = await fetch("/api/mobile-auth/exchange", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, handoff }),
        });
        if (!response.ok) {
          const result = (await response.json()) as { error?: string };
          throw new Error(result.error ?? "Could not finish sign-in in Vitals.");
        }
        window.sessionStorage.removeItem("vitals.auth.handoff");
        window.location.replace("/");
      } catch (error) {
        window.sessionStorage.removeItem("vitals.auth.handoff");
        window.sessionStorage.setItem(
          "vitals.auth.error",
          error instanceof Error
            ? error.message
            : "Could not finish sign-in in Vitals.",
        );
        window.location.replace("/signin");
      } finally {
        processingHandoff.current = false;
      }
    };

    void App.addListener("appUrlOpen", ({ url }) => {
      void completeSignIn(url);
    }).then((listener) => {
      if (!active) {
        void listener.remove();
        return;
      }
      removeUrlListener = () => void listener.remove();
      void App.getLaunchUrl().then((launch) => {
        if (launch?.url) void completeSignIn(launch.url);
      });
    });
    void Browser.addListener("browserFinished", () => {
      window.setTimeout(() => {
        window.dispatchEvent(new Event("vitals-auth-browser-finished"));
      }, 1000);
    }).then((listener) => {
      if (!active) {
        void listener.remove();
        return;
      }
      removeBrowserListener = () => void listener.remove();
    });

    return () => {
      active = false;
      removeUrlListener?.();
      removeBrowserListener?.();
    };
  }, []);

  return null;
}
