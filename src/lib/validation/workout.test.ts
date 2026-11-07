import { describe, expect, it } from "vitest";
import { workoutSchema } from "./workout";

describe("workoutSchema", () => {
  it("accepts a cardio session with optional measurements", () => {
    const result = workoutSchema.safeParse({
      loggedOn: "2026-03-16",
      type: "run",
      durationMin: 30,
      distanceM: 5000,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sets).toEqual([]);
  });

  it("validates exercise sets and effort ranges", () => {
    expect(
      workoutSchema.safeParse({
        loggedOn: "2026-03-16",
        type: "strength",
        perceivedEffort: 11,
        sets: [{ reps: -1 }],
      }).success,
    ).toBe(false);
  });

  it("does not accept manual step counts", () => {
    const result = workoutSchema.safeParse({
      loggedOn: "2026-03-16",
      type: "walk",
      steps: 5000,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("steps");
  });

  it("rejects malformed dates and too many sets", () => {
    expect(
      workoutSchema.safeParse({
        loggedOn: "2026-02-30",
        type: "strength",
        sets: Array.from({ length: 101 }, () => ({})),
      }).success,
    ).toBe(false);
  });
});
