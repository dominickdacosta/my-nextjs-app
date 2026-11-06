import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { medicationLogs, medications } from "@/lib/db/schema";
import { medicationLogRestoreSchema } from "@/lib/validation/medication";

function logId(request: Request): string | null {
  const id = new URL(request.url).pathname.split("/").at(-1);
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

async function deleteMedicationLog(request: Request, userId: string) {
  const id = logId(request);
  if (!id) {
    return NextResponse.json({ error: "Invalid log ID." }, { status: 400 });
  }
  const [entry] = await getDb()
    .delete(medicationLogs)
    .where(and(eq(medicationLogs.id, id), eq(medicationLogs.userId, userId)))
    .returning();
  if (!entry) {
    return NextResponse.json({ error: "Medication log not found." }, { status: 404 });
  }
  return NextResponse.json(entry);
}

async function restoreMedicationLog(request: Request, userId: string) {
  const id = logId(request);
  if (!id) {
    return NextResponse.json({ error: "Invalid log ID." }, { status: 400 });
  }
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = medicationLogRestoreSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);
  const db = getDb();
  const [medication] = await db
    .select({ id: medications.id })
    .from(medications)
    .where(
      and(
        eq(medications.id, result.data.medicationId),
        eq(medications.userId, userId),
      ),
    )
    .limit(1);
  if (!medication) {
    return NextResponse.json({ error: "Medication not found." }, { status: 404 });
  }

  const { loggedAt, scheduledFor, ...values } = result.data;
  const [entry] = await db
    .insert(medicationLogs)
    .values({
      ...values,
      id,
      scheduledFor: new Date(scheduledFor),
      loggedAt: loggedAt ? new Date(loggedAt) : new Date(),
      userId,
    })
    .onConflictDoNothing()
    .returning();
  if (entry) return NextResponse.json(entry);
  const [ownedEntry] = await db
    .select()
    .from(medicationLogs)
    .where(and(eq(medicationLogs.id, id), eq(medicationLogs.userId, userId)))
    .limit(1);
  if (!ownedEntry) {
    return NextResponse.json({ error: "Medication log not found." }, { status: 404 });
  }
  return NextResponse.json(ownedEntry);
}

export const DELETE = withUser(deleteMedicationLog);
export const POST = withUser(restoreMedicationLog);
