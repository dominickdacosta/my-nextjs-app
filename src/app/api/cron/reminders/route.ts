import { eq } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { isReminderScheduledOn } from "@/lib/health/reminders";
import {
  profiles,
  pushSubscriptions,
  reminderDeliveries,
  reminders,
} from "@/lib/db/schema";

function isAuthorized(request: Request): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!configuredSecret || !providedSecret) return false;
  const expected = Buffer.from(configuredSecret);
  const provided = Buffer.from(providedSecret);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json(
      { error: "Push notification keys are not configured." },
      { status: 503 },
    );
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@vitals.app",
    publicKey,
    privateKey,
  );

  const db = getDb();
  const activeReminders = await db
    .select({
      id: reminders.id,
      userId: reminders.userId,
      kind: reminders.kind,
      daysOfWeek: reminders.daysOfWeek,
      timezone: profiles.timezone,
    })
    .from(reminders)
    .innerJoin(profiles, eq(profiles.userId, reminders.userId))
    .where(eq(reminders.enabled, true));

  const now = new Date();
  const scheduledFor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  let delivered = 0;
  let failed = 0;
  let expired = 0;

  for (const reminder of activeReminders) {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, reminder.userId));

    for (const subscription of subscriptions) {
      if (!isReminderScheduledOn(reminder, now)) continue;

      const [claim] = await db
        .insert(reminderDeliveries)
        .values({
          reminderId: reminder.id,
          subscriptionId: subscription.id,
          scheduledFor,
        })
        .onConflictDoNothing()
        .returning({ id: reminderDeliveries.id });
      if (!claim) continue;

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            body: "It's time for your health check-in.",
            url: "/more",
          }),
          { TTL: 86_400 },
        );
        delivered += 1;
      } catch (error) {
        const statusCode =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof error.statusCode === "number"
            ? error.statusCode
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, subscription.id));
          expired += 1;
        } else {
          await db
            .delete(reminderDeliveries)
            .where(eq(reminderDeliveries.id, claim.id));
          failed += 1;
        }
      }
    }
  }

  return NextResponse.json({ delivered, failed, expired });
}
