import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { medications } from "@/lib/db/schema";
import { medicationSchema } from "@/lib/validation/medication";

async function listMedications(_request: Request, userId: string) {
  const entries = await getDb()
    .select()
    .from(medications)
    .where(eq(medications.userId, userId))
    .orderBy(asc(medications.name));
  return NextResponse.json(entries);
}

async function createMedication(request: Request, userId: string) {
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const result = medicationSchema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);
  const [medication] = await getDb()
    .insert(medications)
    .values({ ...result.data, userId })
    .returning();
  return NextResponse.json(medication, { status: 201 });
}

export const GET = withUser(listMedications);
export const POST = withUser(createMedication);
