import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { dailyCheckins, profiles } from "@/lib/db/schema";
import { todayFor } from "@/lib/health/dates";
import { checkinSchema } from "@/lib/validation/checkin";

async function createCheckin(request: Request, userId: string) {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = checkinSchema.safeParse(parsedBody.body);
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

  const { loggedOn: requestedDate, ...values } = result.data;
  const loggedOn = requestedDate ?? todayFor(profile.timezone);
  const [checkin] = await db
    .insert(dailyCheckins)
    .values({ ...values, userId, loggedOn })
    .onConflictDoUpdate({
      target: [dailyCheckins.userId, dailyCheckins.loggedOn],
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  return NextResponse.json(checkin, { status: 201 });
}

export const POST = withUser(createCheckin);
