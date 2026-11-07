import type { RunRoutePoint } from "@/lib/health/workouts";

const earthRadiusM = 6_371_000;

export function haversineDistanceM(
  first: Pick<RunRoutePoint, "latitude" | "longitude">,
  second: Pick<RunRoutePoint, "latitude" | "longitude">,
): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function validGpsStep(
  previous: RunRoutePoint | undefined,
  next: RunRoutePoint,
): boolean {
  if (next.accuracyM > 50) return false;
  if (!previous) return true;
  const elapsedSeconds =
    (Date.parse(next.recordedAt) - Date.parse(previous.recordedAt)) / 1000;
  if (elapsedSeconds <= 0) return false;
  const distanceM = haversineDistanceM(previous, next);
  return distanceM <= 5 || distanceM / elapsedSeconds <= 8;
}

export function sanitizeRunRoutePoints(points: RunRoutePoint[]): RunRoutePoint[] {
  const accepted: RunRoutePoint[] = [];
  for (const point of points) {
    if (!validGpsStep(accepted.at(-1), point)) continue;
    if (
      accepted.length &&
      haversineDistanceM(accepted[accepted.length - 1], point) < 5
    ) {
      continue;
    }
    accepted.push(point);
  }
  return accepted;
}

export function routeDistanceM(points: RunRoutePoint[]): number {
  return points.reduce(
    (distance, point, index) =>
      index
        ? distance + haversineDistanceM(points[index - 1], point)
        : distance,
    0,
  );
}

export function decodeEncodedPolyline(encoded: string): RunRoutePoint[] {
  const points: RunRoutePoint[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const decodeValue = () => {
    let result = 0;
    let shift = 0;
    let value = 0;
    do {
      if (index >= encoded.length || shift > 30) return null;
      value = encoded.charCodeAt(index++) - 63;
      result |= (value & 0x1f) << shift;
      shift += 5;
    } while (value >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length && points.length < 2500) {
    const latitudeDelta = decodeValue();
    const longitudeDelta = decodeValue();
    if (latitudeDelta === null || longitudeDelta === null) break;
    latitude += latitudeDelta;
    longitude += longitudeDelta;
    points.push({
      latitude: latitude / 100_000,
      longitude: longitude / 100_000,
      recordedAt: new Date(0).toISOString(),
      accuracyM: 0,
      altitudeM: null,
    });
  }
  return points;
}

export function averagePaceSecPerKm(
  durationSeconds: number,
  distanceM: number,
): number | null {
  if (durationSeconds <= 0 || distanceM < 100) return null;
  return Math.round(durationSeconds / (distanceM / 1000));
}

export function estimateWorkoutCalories(
  activity: "strength" | "cardio" | "walk" | "run" | "other",
  title: string | null,
  durationMin: number,
  weightKg: number | null,
): number | null {
  if (!weightKg || weightKg <= 0 || durationMin <= 0) return null;
  const activityName = title?.toLowerCase() ?? "";
  const met =
    activity === "run"
      ? 9.8
      : activity === "walk"
        ? 3.3
        : activity === "strength"
          ? 3.5
          : /football|soccer/.test(activityName)
            ? 7
            : /swim/.test(activityName)
              ? 7
              : /cycl/.test(activityName)
                ? 7.5
                : activity === "cardio"
                  ? 6
                  : null;
  return met === null
    ? null
    : Math.round(met * 3.5 * weightKg / 200 * durationMin);
}
