import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { pushSubscriptions } from "@/lib/db/schema";
import {
  pushSubscriptionDeleteSchema,
  pushSubscriptionSchema,
} from "@/lib/validation/reminder";

export const POST = withUser(async (request, userId) => {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = pushSubscriptionSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);

  const [saved] = await getDb()
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: result.data.endpoint,
      p256dh: result.data.keys.p256dh,
      auth: result.data.keys.auth,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: result.data.keys.p256dh,
        auth: result.data.keys.auth,
        updatedAt: new Date(),
      },
    })
    .returning({ id: pushSubscriptions.id });
  if (!saved) throw new Error("Push subscription save returned no row.");
  return NextResponse.json({ subscribed: true }, { status: 201 });
});

export const DELETE = withUser(async (request, userId) => {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = pushSubscriptionDeleteSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);
  await getDb()
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, result.data.endpoint),
      ),
    );
  return NextResponse.json({ subscribed: false });
});
