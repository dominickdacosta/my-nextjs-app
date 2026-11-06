import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { bodyMeasurements, profiles } from "@/lib/db/schema";
import { todayFor } from "@/lib/health/dates";
import { invalidInput, withUser } from "@/lib/api";
import {
  profileSchema,
  profileUpdateSchema,
  type ProfileInput,
} from "@/lib/validation/profile";

async function readProfile(request: Request, userId: string) {
  void request;
  const [profile] = await getDb()
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  return NextResponse.json(profile);
}

async function writeProfile(request: Request, userId: string, onboarding: boolean) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    throw error;
  }

  let parsedProfile: ProfileInput;
  if (onboarding) {
    const result = profileSchema.safeParse(body);
    if (!result.success) return invalidInput(result.error.issues);
    parsedProfile = result.data;
  } else {
    const result = profileUpdateSchema.safeParse(body);
    if (!result.success) return invalidInput(result.error.issues);
    parsedProfile = { ...result.data, currentWeightKg: undefined };
  }
  const { currentWeightKg, ...profileInput } = parsedProfile;
  const db = getDb();
  const now = new Date();
  const values = {
    ...profileInput,
    targetWeightKg: profileInput.targetWeightKg ?? null,
    userId,
    updatedAt: now,
  };
  let savedProfile: typeof profiles.$inferSelect | undefined;
  if (onboarding) {
    [savedProfile] = await db
      .insert(profiles)
      .values({ ...values, onboardedAt: null })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: values,
      })
      .returning();
  } else {
    [savedProfile] = await db
      .update(profiles)
      .set(values)
      .where(eq(profiles.userId, userId))
      .returning();
    if (!savedProfile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }
  }
  if (!savedProfile) throw new Error("Profile write returned no row.");

  if (onboarding && currentWeightKg !== undefined) {
    const loggedOn = todayFor(profileInput.timezone);
    const [existingMeasurement] = await db
      .select({ id: bodyMeasurements.id })
      .from(bodyMeasurements)
      .where(
        and(
          eq(bodyMeasurements.userId, userId),
          eq(bodyMeasurements.loggedOn, loggedOn),
        ),
      )
      .limit(1);
    if (!existingMeasurement) {
      await db.insert(bodyMeasurements).values({
        userId,
        loggedOn,
        loggedAt: now,
        weightKg: currentWeightKg,
      });
    }
  }

  return NextResponse.json(savedProfile);
}

export const GET = withUser(readProfile);
export const PUT = withUser((request, userId) =>
  writeProfile(request, userId, false),
);
export const POST = withUser((request, userId) =>
  writeProfile(request, userId, true),
);
