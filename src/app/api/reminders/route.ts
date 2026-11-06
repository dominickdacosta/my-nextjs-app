import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { reminders } from "@/lib/db/schema";
import { reminderSchema } from "@/lib/validation/reminder";

export const GET = withUser(async (_request, userId) => {
  const rows = await getDb()
    .select({
      id: reminders.id,
      kind: reminders.kind,
      time: reminders.time,
      daysOfWeek: reminders.daysOfWeek,
      enabled: reminders.enabled,
    })
    .from(reminders)
    .where(eq(reminders.userId, userId))
    .orderBy(asc(reminders.time));
  return NextResponse.json(rows, {
    headers: { "Cache-Control": "private, no-store" },
  });
});

export const POST = withUser(async (request, userId) => {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = reminderSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);

  const [created] = await getDb()
    .insert(reminders)
    .values({ ...result.data, userId })
    .returning({
      id: reminders.id,
      kind: reminders.kind,
      time: reminders.time,
      daysOfWeek: reminders.daysOfWeek,
      enabled: reminders.enabled,
    });
  if (!created) throw new Error("Reminder creation returned no row.");
  return NextResponse.json(created, { status: 201 });
});
