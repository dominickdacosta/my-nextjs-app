import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const deleteAccountSchema = z.object({ confirmation: z.literal("DELETE") });

export const DELETE = withUser(async (request, userId) => {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = deleteAccountSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);

  const [deleted] = await getDb()
    .delete(users)
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (!deleted) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
});
