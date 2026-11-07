import { describe, expect, it } from "vitest";
import {
  aggregateTrendDays,
  compareLoggedTotals,
  countLogStreaks,
  summarizeStrengthProgress,
} from "./trends";

describe("health trends", () => {
  it("aggregates meals, hydration, exercise, and daily logs", () => {
    const days = aggregateTrendDays({
      dates: ["2026-03-15", "2026-03-16"],
      food: [
        { loggedOn: "2026-03-15", servings: 2, kcal: 100, proteinG: 5, carbsG: 20, fatG: 3, fiberG: 4 },
        { loggedOn: "2026-03-15", servings: 1, kcal: 50, proteinG: null },
      ],
      water: [{ loggedOn: "2026-03-15", amountMl: 500 }],
      weights: [{ loggedOn: "2026-03-15", weightKg: 70 }],
      workouts: [{
        loggedOn: "2026-03-15",
        durationMin: 30,
        durationSeconds: 1800,
        type: "run",
        distanceM: 5000,
      }],
      sleep: [{ loggedOn: "2026-03-15", durationMin: 420 }],
      activity: [{
        loggedOn: "2026-03-15",
        steps: 4000,
        activeMinutes: 10,
        source: "health-connect",
      }],
      vitals: [],
    });

    expect(days[0]).toMatchObject({
      caloriesKcal: 250,
      proteinG: 10,
      carbsG: 40,
      fatG: 6,
      fiberG: 8,
      waterMl: 500,
      weightKg: 70,
      workoutCount: 1,
      activeMinutes: 40,
      runCount: 1,
      runDistanceM: 5000,
      avgRunPaceSecPerKm: 360,
      sleepMinutes: 420,
      steps: 4000,
      hasLog: true,
    });
    expect(days[1].hasLog).toBe(false);
  });

  it("excludes manually sourced steps from trends", () => {
    const [day] = aggregateTrendDays({
      dates: ["2026-03-15"],
      food: [],
      water: [],
      weights: [],
      workouts: [],
      sleep: [],
      activity: [{
        loggedOn: "2026-03-15",
        steps: 7000,
        activeMinutes: 20,
        source: "manual",
      }],
      vitals: [],
    });

    expect(day.steps).toBe(0);
    expect(day.activeMinutes).toBe(20);
  });

  it("compares logged periods and summarizes strength progression", () => {
      const current = aggregateTrendDays({
        dates: ["2026-03-16"],
        food: [{ loggedOn: "2026-03-16", servings: 1, kcal: 500, proteinG: 30 }],
        water: [],
        weights: [],
        workouts: [{ loggedOn: "2026-03-16", durationMin: 30, type: "run", distanceM: 3000 }],
        sleep: [],
        activity: [],
        vitals: [],
      });
      const previous = aggregateTrendDays({
        dates: ["2026-03-15"],
        food: [{ loggedOn: "2026-03-15", servings: 1, kcal: 500, proteinG: 20 }],
        water: [],
        weights: [],
        workouts: [{ loggedOn: "2026-03-15", durationMin: 20, type: "run", distanceM: 2000 }],
        sleep: [],
        activity: [],
        vitals: [],
      });
      expect(compareLoggedTotals(current, previous)).toMatchObject({
        currentProteinAverage: 30,
        previousProteinAverage: 20,
        currentRunDistanceM: 3000,
        previousRunDistanceM: 2000,
      });
      expect(
        summarizeStrengthProgress([
          {
            exerciseId: "squat",
            exerciseName: "Squat",
            loggedOn: "2026-03-15",
            weightKg: 50,
            reps: 8,
            isWarmup: false,
            completed: true,
          },
          {
            exerciseId: "squat",
            exerciseName: "Squat",
            loggedOn: "2026-03-16",
            weightKg: 55,
            reps: 6,
            isWarmup: false,
            completed: true,
          },
        ]),
      ).toEqual([{
        exerciseId: "squat",
        name: "Squat",
        personalBestKg: 55,
        latestBestKg: 55,
        previousBestKg: 50,
      }]);
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
