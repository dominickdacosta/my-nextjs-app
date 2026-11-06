import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { medicationLogs, medications, profiles } from "@/lib/db/schema";
import { isDateString, todayFor } from "@/lib/health/dates";
import { medicationLogSchema } from "@/lib/validation/medication";

async function listMedicationLogs(request: Request, userId: string) {
  const dateParam = new URL(request.url).searchParams.get("date");
  if (dateParam && !isDateString(dateParam)) {
    return NextResponse.json({ error: "Date must use YYYY-MM-DD format." }, { status: 400 });
  }
  const db = getDb();
  const [profile] = await db
    .select({ timezone: profiles.timezone })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  const date = dateParam ?? todayFor(profile.timezone);
  const entries = await db
    .select({
      id: medicationLogs.id,
      medicationId: medicationLogs.medicationId,
      medicationName: medications.name,
      dose: medications.dose,
      loggedOn: medicationLogs.loggedOn,
      scheduledFor: medicationLogs.scheduledFor,
      status: medicationLogs.status,
      loggedAt: medicationLogs.loggedAt,
    })
    .from(medicationLogs)
    .innerJoin(medications, eq(medicationLogs.medicationId, medications.id))
    .where(
      and(
        eq(medicationLogs.userId, userId),
        eq(medicationLogs.loggedOn, date),
        eq(medications.userId, userId),
      ),
    )
    .orderBy(asc(medicationLogs.scheduledFor));
  return NextResponse.json(entries);
}

async function createMedicationLog(request: Request, userId: string) {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = medicationLogSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);
  const db = getDb();
  const [medication] = await db
    .select({ id: medications.id })
    .from(medications)
    .where(
      and(
        eq(medications.id, result.data.medicationId),
        eq(medications.userId, userId),
        eq(medications.active, true),
      ),
    )
    .limit(1);
  if (!medication) {
    return NextResponse.json({ error: "Medication not found." }, { status: 404 });
  }
  const [entry] = await db
    .insert(medicationLogs)
    .values({
      ...result.data,
      scheduledFor: new Date(result.data.scheduledFor),
      userId,
    })
    .onConflictDoUpdate({
      target: [
        medicationLogs.userId,
        medicationLogs.medicationId,
        medicationLogs.scheduledFor,
      ],
      set: {
        status: result.data.status,
        loggedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();
  if (entry) return NextResponse.json(entry, { status: 201 });
  const [existing] = await db
    .select()
    .from(medicationLogs)
    .where(
      and(
        eq(medicationLogs.userId, userId),
        eq(medicationLogs.medicationId, result.data.medicationId),
        eq(medicationLogs.scheduledFor, new Date(result.data.scheduledFor)),
      ),
    )
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Medication log could not be saved." }, { status: 500 });
  }
  return NextResponse.json(existing);
}

export const GET = withUser(listMedicationLogs);
export const POST = withUser(createMedicationLog);
