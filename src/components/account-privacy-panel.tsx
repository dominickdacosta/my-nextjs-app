"use client";

import { useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";

export default function AccountPrivacyPanel() {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  async function importBackup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!backupFile) return;
    setImportMessage("");
    setImportBusy(true);
    try {
      if (backupFile.size > 10 * 1024 * 1024) {
        throw new Error("Backup files must be 10 MB or smaller.");
      }
      const response = await fetch("/api/account/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await backupFile.text(),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not import this backup.");
      }
      setImportMessage("Backup data was imported. Refreshing your health data...");
      window.location.reload();
    } catch (actionError) {
      setImportMessage(
        actionError instanceof Error
          ? actionError.message
          : "Could not import this backup.",
      );
    } finally {
      setImportBusy(false);
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Could not delete the account.");
      }
      await signOut({ redirectTo: "/signin" });
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not delete the account.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-8 border-t border-line pt-6 sm:grid-cols-2">
      <div>
        <h3 className="font-semibold">Your data</h3>
        <p className="mt-2 text-sm text-muted">
          Download a JSON backup of your profile, goals, logs, saved foods, and reminders.
          Keep the file somewhere private; it contains sensitive health information.
        </p>
        <a
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-line px-5 text-sm font-medium"
          href="/api/account/export"
        >
          Download my data
        </a>
        <form className="mt-4 grid gap-3" onSubmit={(event) => void importBackup(event)}>
          <label className="grid gap-2 text-sm font-medium">
            Restore a Vitals JSON backup
            <input
              accept="application/json,.json"
              className="text-sm"
              onChange={(event) => setBackupFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          {importMessage ? <p aria-live="polite" className="text-sm text-muted" role="status">{importMessage}</p> : null}
          <p className="text-xs leading-5 text-muted">
            Restore merges records and skips conflicts. To restore into a different account on this database, delete the source account first.
          </p>
          <button
            className="min-h-11 justify-self-start rounded-xl border border-line px-5 text-sm font-medium disabled:opacity-60"
            disabled={!backupFile || importBusy}
            type="submit"
          >
            {importBusy ? "Importing..." : "Import backup"}
          </button>
        </form>
      </div>
      <div>
        <h3 className="font-semibold text-red-800">Delete account and data</h3>
        <p className="mt-2 text-sm text-muted">
          This permanently removes your account and all associated health records. This cannot be undone.
        </p>
        <form className="mt-4 grid gap-3" onSubmit={(event) => void deleteAccount(event)}>
          <label className="grid gap-2 text-sm font-medium">
            Type DELETE to confirm
            <input
              autoComplete="off"
              className="min-h-11 rounded-xl border border-line bg-paper px-3"
              onChange={(event) => setConfirmation(event.target.value)}
              required
              value={confirmation}
            />
          </label>
          {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
          <button
            className="min-h-11 justify-self-start rounded-xl bg-red-800 px-5 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy || confirmation !== "DELETE"}
            type="submit"
          >
            Permanently delete account
          </button>
        </form>
      </div>
    </div>
  );
}
