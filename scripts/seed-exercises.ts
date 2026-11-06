import { loadEnvConfig } from "@next/env";
import { seedExerciseLibrary } from "../src/lib/db/seed";

loadEnvConfig(process.cwd());

seedExerciseLibrary()
  .then((count) => console.log(`Added ${count} exercises to the library.`))
  .catch((error: unknown) => {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.error(`Exercise seed failed (${errorType}).`);
    process.exitCode = 1;
  });
