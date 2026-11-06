import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

async function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  try {
    const contents = await readFile(".env.local", "utf8");
    const entry = contents
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith("DATABASE_URL="));
    const value = entry
      ?.slice(entry.indexOf("=") + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (value) return value;
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }

  throw new Error("Set DATABASE_URL in the environment or .env.local.");
}

function isMissingFile(error) {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

const sql = neon(await loadDatabaseUrl());
const rows = await sql`SELECT id, data FROM household_tasks ORDER BY id`;
const outputPath = path.join("data", "chores-archive.json");

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(rows, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});

console.log(`Exported ${rows.length} chore records to ${outputPath}.`);
