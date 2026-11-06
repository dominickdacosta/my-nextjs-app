import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { invalidInput, readJson, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { medications } from "@/lib/db/schema";
import { medicationSchema } from "@/lib/validation/medication";

function medicationId(request: Request): string | null {
  const id = new URL(request.url).pathname.split("/").at(-1);
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

async function updateMedication(request: Request, userId: string) {
  const id = medicationId(request);
  if (!id) {
    return NextResponse.json({ error: "Invalid medication ID." }, { status: 400 });
  }
  const parsedBody = await readJson(request);
  if (parsedBody.response) return parsedBody.response;
  const schema = medicationSchema.partial().refine(
    (values) => Object.keys(values).length > 0,
    "Enter at least one medication field.",
  );
  const result = schema.safeParse(parsedBody.body);
  if (!result.success) return invalidInput(result.error.issues);

  const [medication] = await getDb()
    .update(medications)
    .set({ ...result.data, updatedAt: new Date() })
    .where(and(eq(medications.id, id), eq(medications.userId, userId)))
    .returning();
  if (!medication) {
    return NextResponse.json({ error: "Medication not found." }, { status: 404 });
  }
  return NextResponse.json(medication);
}

async function deleteMedication(request: Request, userId: string) {
  const id = medicationId(request);
  if (!id) {
    return NextResponse.json({ error: "Invalid medication ID." }, { status: 400 });
  }
  const [medication] = await getDb()
    .delete(medications)
    .where(and(eq(medications.id, id), eq(medications.userId, userId)))
    .returning();
  if (!medication) {
    return NextResponse.json({ error: "Medication not found." }, { status: 404 });
  }
  return NextResponse.json(medication);
}

export const PATCH = withUser(updateMedication);
export const DELETE = withUser(deleteMedication);
