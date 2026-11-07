import { describe, expect, it } from "vitest";
import { workoutTemplateSchema } from "./workout-template";

describe("workout templates", () => {
  it("accepts reusable exercises and rejects an empty or excessive template", () => {
    const exerciseId = "7992eb7b-b78d-4c7a-89a6-603853c4bd45";
    expect(
      workoutTemplateSchema.safeParse({
        name: "Upper body",
        exercises: [{
          exerciseId,
          targetSets: 3,
          targetReps: 8,
          targetWeightKg: 40,
        }],
      }).success,
    ).toBe(true);
    expect(workoutTemplateSchema.safeParse({ name: "Empty", exercises: [] }).success).toBe(false);
    expect(
      workoutTemplateSchema.safeParse({
        name: "Invalid",
        exercises: [{ exerciseId, targetSets: 0, targetReps: 8 }],
      }).success,
    ).toBe(false);
  });
});
