import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Set DATABASE_URL before running database migrations.");
}
const databaseUrl = connectionString;

function safeErrorDetails(error: unknown): string {
  const sanitized = (value: string | undefined) =>
    value?.replaceAll(databaseUrl, "[DATABASE_URL]").replace(
      /(?:postgres(?:ql)?:\/\/)[^\s"'<>]+/gi,
      "[DATABASE_URL]",
    );
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 5; depth += 1) {
    const databaseError = current as Error & {
      code?: string;
      detail?: string;
      hint?: string;
      schema?: string;
      table?: string;
      constraint?: string;
      cause?: unknown;
    };
    const details = [
      databaseError.code ? `code: ${databaseError.code}` : null,
      sanitized(databaseError.message),
      sanitized(databaseError.detail),
      sanitized(databaseError.hint),
      databaseError.schema ? `schema: ${databaseError.schema}` : null,
      databaseError.table ? `table: ${databaseError.table}` : null,
      databaseError.constraint ? `constraint: ${databaseError.constraint}` : null,
    ].filter(Boolean);
    messages.push(details.join("\n"));
    current = databaseError.cause;
  }

  return messages.length ? messages.join("\nCaused by:\n") : "Unknown migration error.";
}

async function main() {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10_000,
  });
  try {
    const database = drizzle(pool);
    await migrate(database, { migrationsFolder: "./drizzle" });
    console.log("Database migrations applied successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Database migration failed:");
  console.error(safeErrorDetails(error));
  process.exitCode = 1;
});
