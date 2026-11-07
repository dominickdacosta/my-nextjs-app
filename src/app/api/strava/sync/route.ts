import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { stravaConnections, workouts } from "@/lib/db/schema";
import { averagePaceSecPerKm } from "@/lib/health/running";
import { stravaAccessToken, StravaError } from "@/lib/health/strava";
import { z } from "zod";

const stravaActivitySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(160),
  type: z.string().max(80),
  sport_type: z.string().max(80).optional(),
  start_date: z.string().datetime(),
  start_date_local: z.string().datetime(),
  moving_time: z.number().int().min(0).max(86400),
  elapsed_time: z.number().int().min(0).max(86400),
  distance: z.number().min(0).max(1000000),
  total_elevation_gain: z.number().min(0).max(100000),
  average_heartrate: z.number().min(30).max(250).nullable().optional(),
  map: z.object({ summary_polyline: z.string().max(100000).nullable().optional() }).optional(),
});

const pageSize = 100;
const pageLimit = 10;

function workoutType(sport: string): "strength" | "cardio" | "walk" | "run" | "other" {
  const type = sport.toLowerCase();
  if (type.includes("run")) return "run";
  if (type.includes("walk") || type.includes("hike")) return "walk";
  if (/weight|workout|crossfit/.test(type)) return "strength";
  if (/ride|cycle|swim|soccer|football|rowing|elliptical/.test(type)) return "cardio";
  return "other";
}

export const POST = withUser(async (_request, userId) => {
  const db = getDb();
  const [connection] = await db
    .select({
      lastSyncedAt: stravaConnections.lastSyncedAt,
      historyCursor: stravaConnections.historyCursor,
    })
    .from(stravaConnections)
    .where(eq(stravaConnections.userId, userId))
    .limit(1);
  if (!connection) {
    return NextResponse.json({ error: "Connect a Strava account before syncing." }, { status: 409 });
  }

  let accessToken: string | null;
  try {
    accessToken = await stravaAccessToken(userId);
  } catch (error) {
    if (error instanceof StravaError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
  if (!accessToken) {
    return NextResponse.json({ error: "Connect a Strava account before syncing." }, { status: 409 });
  }

  const historyStart = 0;
  const isBackfill = connection.historyCursor !== null;
  const after = isBackfill
    ? historyStart
    : connection.lastSyncedAt
      ? Math.max(historyStart, Math.floor(connection.lastSyncedAt.getTime() / 1000) - 300)
      : historyStart;
  let page = 1;
  let imported = 0;
  let oldestTimestamp: number | null = null;
  let hasMore = false;

  while (page <= pageLimit) {
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    url.searchParams.set("per_page", String(pageSize));
    url.searchParams.set("page", String(page));
    url.searchParams.set("after", String(after));
    if (isBackfill && connection.historyCursor !== null) {
      url.searchParams.set("before", String(connection.historyCursor));
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      return NextResponse.json({ error: "Strava activity sync is temporarily unavailable." }, { status: 502 });
    }
    if (response.status === 429) {
      return NextResponse.json(
        { error: "Strava rate limit reached. Try syncing again later." },
        { status: 429 },
      );
    }
    if (!response.ok) {
      return NextResponse.json({ error: "Strava activity sync is temporarily unavailable." }, { status: 502 });
    }

    const raw: unknown = await response.json();
    const parsed = z.array(stravaActivitySchema).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Strava returned invalid activity data." }, { status: 502 });
    }
    if (!parsed.data.length) break;

    const values = parsed.data.flatMap((activity) => {
      const loggedOn = activity.start_date_local.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(loggedOn)) return [];
      const started = Math.floor(Date.parse(activity.start_date) / 1000);
      oldestTimestamp =
        oldestTimestamp === null ? started : Math.min(oldestTimestamp, started);
      const activityType = workoutType(activity.sport_type ?? activity.type);
      const durationSeconds = activity.moving_time || activity.elapsed_time;
      const distanceM = Math.round(activity.distance);
      return [{
        id: crypto.randomUUID(),
        userId,
        loggedOn,
        loggedAt: new Date(activity.start_date),
        type: activityType,
        title: activity.name,
        startedAt: new Date(activity.start_date),
        durationMin: durationSeconds ? Math.max(1, Math.round(durationSeconds / 60)) : null,
        durationSeconds: durationSeconds || null,
        distanceM: distanceM || null,
        avgHeartRate: activity.average_heartrate !== null && activity.average_heartrate !== undefined
          ? Math.round(activity.average_heartrate)
          : null,
        caloriesBurned: null,
        caloriesEstimated: false,
        avgPaceSecPerKm:
          activityType === "run"
            ? averagePaceSecPerKm(durationSeconds, distanceM)
            : null,
        elevationM: Math.round(activity.total_elevation_gain),
        routePolyline: activity.map?.summary_polyline ?? null,
        source: "strava",
        externalActivityId: String(activity.id),
      }];
    });

    if (values.length) {
      const rows = await db
        .insert(workouts)
        .values(values)
        .onConflictDoNothing()
        .returning({ id: workouts.id });
      imported += rows.length;
    }

    if (parsed.data.length < pageSize) break;
    if (page === pageLimit) {
      hasMore = true;
      break;
    }
    page += 1;
  }

  const nextCursor = hasMore && oldestTimestamp !== null ? oldestTimestamp - 1 : null;
  const nextSyncCheckpoint =
    connection.lastSyncedAt ??
    (hasMore ? new Date() : null);
  await db
    .update(stravaConnections)
    .set({
      historyCursor: nextCursor,
      lastSyncedAt:
        nextCursor !== null
          ? nextSyncCheckpoint
          : isBackfill
            ? connection.lastSyncedAt
            : new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(stravaConnections.userId, userId)));

  return NextResponse.json({ imported, hasMore });
});
