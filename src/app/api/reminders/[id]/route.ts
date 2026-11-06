import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { reminders } from "@/lib/db/schema";

function entryId(request: Request): string | null {
  const id = new URL(request.url).pathname.split("/").at(-1);
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

export const DELETE = withUser(async (request, userId) => {
  const id = entryId(request);
  if (!id) {
    return NextResponse.json({ error: "Invalid reminder ID." }, { status: 400 });
  }
  const [deleted] = await getDb()
    .delete(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)))
    .returning({ id: reminders.id });
  if (!deleted) {
    return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
  }
  return NextResponse.json({ id: deleted.id });
});
