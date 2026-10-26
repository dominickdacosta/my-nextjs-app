import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

async function loadLocalDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const contents = await readFile(".env.local", "utf8");
  const entry = contents
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith("DATABASE_URL="));
  const value = entry?.slice(entry.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  if (!value) {
    throw new Error("Set DATABASE_URL in .env.local before migrating tasks.");
  }
  return value;
}

function isTaskRecord(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.id === "string" &&
    value.id.length > 0
  );
}

const databaseUrl = await loadLocalDatabaseUrl();
const contents = JSON.parse(await readFile("data/tasks.json", "utf8"));
if (!Array.isArray(contents) || !contents.every(isTaskRecord)) {
  throw new Error("data/tasks.json must contain an array of tasks with IDs.");
}

const sql = neon(databaseUrl);
await sql`
  CREATE TABLE IF NOT EXISTS household_tasks (
    id text PRIMARY KEY,
    data jsonb NOT NULL
  )
`;

if (contents.length > 0) {
  await sql.transaction(
    contents.map(
      (task) => sql`
        INSERT INTO household_tasks (id, data)
        VALUES (${task.id}, ${JSON.stringify(task)}::jsonb)
        ON CONFLICT (id) DO NOTHING
      `,
    ),
  );
}

console.log(
  `Processed ${contents.length} local tasks. Existing database rows were left unchanged.`,
);
