import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { dailyActivity, profiles } from "@/lib/db/schema";
import { todayFor } from "@/lib/health/dates";
import { z } from "zod";

const stepsSchema = z.object({
  steps: z.number().int().min(0).max(100_000),
});

export const POST = withUser(async (request, userId) => {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = stepsSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);

  const db = getDb();
  const [profile] = await db
    .select({ timezone: profiles.timezone })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const now = new Date();
  const [activity] = await db
    .insert(dailyActivity)
    .values({
      userId,
      loggedOn: todayFor(profile.timezone),
      loggedAt: now,
      steps: result.data.steps,
      source: "health-connect",
    })
    .onConflictDoUpdate({
      target: [dailyActivity.userId, dailyActivity.loggedOn],
      set: {
        steps: result.data.steps,
        source: "health-connect",
        loggedAt: now,
        updatedAt: now,
      },
    })
    .returning();
  return NextResponse.json(activity);
});
