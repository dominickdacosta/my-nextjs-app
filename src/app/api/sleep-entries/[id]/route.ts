import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { sleepEntries } from "@/lib/db/schema";
import { sleepRestoreSchema } from "@/lib/validation/sleep-entry";

function entryId(request: Request): string | null {
  const id = new URL(request.url).pathname.split("/").at(-1);
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

async function deleteSleep(request: Request, userId: string) {
  const id = entryId(request);
  if (!id) {
    return NextResponse.json({ error: "Invalid entry ID." }, { status: 400 });
  }
  const [entry] = await getDb()
    .delete(sleepEntries)
    .where(and(eq(sleepEntries.id, id), eq(sleepEntries.userId, userId)))
    .returning();
  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  return NextResponse.json(entry);
}

async function restoreSleep(request: Request, userId: string) {
  const id = entryId(request);
  if (!id) {
    return NextResponse.json({ error: "Invalid entry ID." }, { status: 400 });
  }
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = sleepRestoreSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);
  const { loggedAt, bedAt, wakeAt } = result.data;
  const db = getDb();
  const values: typeof sleepEntries.$inferInsert = {
    id,
    userId,
    loggedOn: result.data.loggedOn,
    sleepDate: result.data.sleepDate,
    loggedAt: loggedAt ? new Date(loggedAt) : new Date(),
    bedAt: bedAt == null ? bedAt : new Date(bedAt),
    wakeAt: wakeAt == null ? wakeAt : new Date(wakeAt),
    durationMin: result.data.durationMin,
    quality: result.data.quality,
    awakenings: result.data.awakenings,
    notes: result.data.notes,
  };
  const [entry] = await db
    .insert(sleepEntries)
    .values(values)
    .onConflictDoNothing()
    .returning();
  if (entry) return NextResponse.json(entry);
  const [ownedEntry] = await db
    .select()
    .from(sleepEntries)
    .where(and(eq(sleepEntries.id, id), eq(sleepEntries.userId, userId)))
    .limit(1);
  if (!ownedEntry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  return NextResponse.json(ownedEntry);
}

export const DELETE = withUser(deleteSleep);
export const POST = withUser(restoreSleep);
