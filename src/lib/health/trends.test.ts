import { describe, expect, it } from "vitest";
import { aggregateTrendDays, countLogStreaks } from "./trends";

describe("health trends", () => {
  it("aggregates meals, hydration, exercise, and daily logs", () => {
    const days = aggregateTrendDays({
      dates: ["2026-03-15", "2026-03-16"],
      food: [
        { loggedOn: "2026-03-15", servings: 2, kcal: 100, proteinG: 5 },
        { loggedOn: "2026-03-15", servings: 1, kcal: 50, proteinG: null },
      ],
      water: [{ loggedOn: "2026-03-15", amountMl: 500 }],
      weights: [{ loggedOn: "2026-03-15", weightKg: 70 }],
      workouts: [{ loggedOn: "2026-03-15", durationMin: 30 }],
      sleep: [{ loggedOn: "2026-03-15", durationMin: 420 }],
      activity: [{ loggedOn: "2026-03-15", steps: 4000, activeMinutes: 10 }],
      checkins: [{ loggedOn: "2026-03-15", mood: 4, energy: 3 }],
      vitals: [],
    });

    expect(days[0]).toMatchObject({
      caloriesKcal: 250,
      proteinG: 10,
      waterMl: 500,
      weightKg: 70,
      workoutCount: 1,
      activeMinutes: 40,
      sleepMinutes: 420,
      steps: 4000,
      mood: 4,
      energy: 3,
      hasLog: true,
    });
    expect(days[1].hasLog).toBe(false);
  });

  it("counts current and best log streaks without requiring today's entry", () => {
    const days = aggregateTrendDays({
      dates: [
        "2026-03-12",
        "2026-03-13",
        "2026-03-14",
        "2026-03-15",
        "2026-03-16",
      ],
      food: [],
      water: [{ loggedOn: "2026-03-12", amountMl: 250 }],
      weights: [],
      workouts: [
        { loggedOn: "2026-03-13", durationMin: 20 },
        { loggedOn: "2026-03-14", durationMin: 30 },
        { loggedOn: "2026-03-15", durationMin: 35 },
        { loggedOn: "2026-03-16", durationMin: 40 },
      ],
      sleep: [],
      activity: [],
      checkins: [],
      vitals: [],
    });

    expect(countLogStreaks(days, "2026-03-16")).toEqual({
      current: 5,
      best: 5,
      loggedDays: 5,
    });
    days[4].hasLog = false;
    expect(countLogStreaks(days, "2026-03-16").current).toBe(4);
  });
});
