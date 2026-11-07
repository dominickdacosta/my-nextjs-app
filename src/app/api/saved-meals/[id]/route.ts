import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { savedMeals } from "@/lib/db/schema";

export const DELETE = withUser(async (request, userId) => {
  const id = new URL(request.url).pathname.split("/").at(-1);
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid saved meal ID." }, { status: 400 });
  }
  const [deleted] = await getDb()
    .delete(savedMeals)
    .where(and(eq(savedMeals.id, id), eq(savedMeals.userId, userId)))
    .returning({ id: savedMeals.id });
  if (!deleted) return NextResponse.json({ error: "Saved meal not found." }, { status: 404 });
  return NextResponse.json({ deleted: true });
});
