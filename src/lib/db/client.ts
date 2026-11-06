import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb(connectionString: string) {
  return drizzle(neon(connectionString), { schema });
}

type Database = ReturnType<typeof createDb>;
let database: Database | undefined;

export function getDb(): Database {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured for database access.");
  }
  database ??= createDb(connectionString);
  return database;
}
