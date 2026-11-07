import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { stravaConnections } from "@/lib/db/schema";
import { stravaIsConfigured } from "@/lib/health/strava";

export const GET = withUser(async (_request, userId) => {
  const [connection] = await getDb()
    .select({
      lastSyncedAt: stravaConnections.lastSyncedAt,
      historyCursor: stravaConnections.historyCursor,
    })
    .from(stravaConnections)
    .where(eq(stravaConnections.userId, userId))
    .limit(1);
  return NextResponse.json({
    configured: stravaIsConfigured(),
    connected: Boolean(connection),
    lastSyncedAt: connection?.lastSyncedAt ?? null,
    syncingHistory: connection?.historyCursor !== null && connection?.historyCursor !== undefined,
  });
});

export const DELETE = withUser(async (_request, userId) => {
  await getDb()
    .delete(stravaConnections)
    .where(eq(stravaConnections.userId, userId));
  return NextResponse.json({ disconnected: true });
});
