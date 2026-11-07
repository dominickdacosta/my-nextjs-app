import { describe, expect, it } from "vitest";
import {
  averagePaceSecPerKm,
  estimateWorkoutCalories,
  routeDistanceM,
  sanitizeRunRoutePoints,
  validGpsStep,
} from "./running";
import type { RunRoutePoint } from "./workouts";

function point(
  latitude: number,
  longitude: number,
  seconds: number,
  accuracyM = 5,
): RunRoutePoint {
  return {
    latitude,
    longitude,
    recordedAt: new Date(seconds * 1000).toISOString(),
    accuracyM,
    altitudeM: null,
  };
}

describe("running calculations", () => {
  it("filters inaccurate fixes and impossible GPS jumps", () => {
    const start = point(0, 0, 1);
    expect(validGpsStep(start, point(0, 0.00005, 2))).toBe(true);
    expect(validGpsStep(start, point(1, 1, 2))).toBe(false);
    expect(validGpsStep(start, point(0, 0.0001, 2, 80))).toBe(false);
    expect(
      sanitizeRunRoutePoints([
        start,
        point(0, 0.00005, 2),
        point(1, 1, 3),
      ]),
    ).toHaveLength(2);
  });

  it("calculates distance and pace from accepted points", () => {
    const route = [point(0, 0, 1), point(0, 0.009, 541)];
    expect(routeDistanceM(route)).toBeGreaterThan(990);
    expect(averagePaceSecPerKm(540, 1000)).toBe(540);
    expect(averagePaceSecPerKm(100, 50)).toBeNull();
  });

  it("estimates workout calories only when body weight is available", () => {
    expect(estimateWorkoutCalories("walk", null, 30, null)).toBeNull();
    expect(estimateWorkoutCalories("run", null, 30, 70)).toBeGreaterThan(300);
  });
});
