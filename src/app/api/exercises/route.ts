import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { exercises } from "@/lib/db/schema";

async function searchExercises(request: Request, userId: string) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) {
    return NextResponse.json(
      { error: "Search text must be between 2 and 100 characters." },
      { status: 400 },
    );
  }
  const results = await getDb()
    .select({
      id: exercises.id,
      name: exercises.name,
      category: exercises.category,
      primaryMuscle: exercises.primaryMuscle,
      equipment: exercises.equipment,
      tracks: exercises.tracks,
    })
    .from(exercises)
    .where(
      and(
        or(isNull(exercises.userId), eq(exercises.userId, userId)),
        ilike(exercises.name, `%${query}%`),
      ),
    )
    .orderBy(asc(exercises.name))
    .limit(20);
  return NextResponse.json(results);
}

export const GET = withUser(searchExercises);
