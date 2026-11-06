import { isNull } from "drizzle-orm";
import { getDb } from "./client";
import { exercises } from "./schema";

type ExerciseSeed = {
  name: string;
  category: "strength" | "cardio" | "flexibility" | "sport";
  primaryMuscle: string;
  equipment: string;
  metValue: number;
  tracks: "weight_reps" | "reps" | "duration" | "distance_duration";
};

const exerciseSeeds: ExerciseSeed[] = [
  ["Barbell squat", "strength", "quadriceps", "barbell", 5, "weight_reps"],
  ["Front squat", "strength", "quadriceps", "barbell", 5, "weight_reps"],
  ["Goblet squat", "strength", "quadriceps", "dumbbell", 5, "weight_reps"],
  ["Deadlift", "strength", "hamstrings", "barbell", 6, "weight_reps"],
  ["Romanian deadlift", "strength", "hamstrings", "barbell", 5, "weight_reps"],
  ["Hip thrust", "strength", "glutes", "barbell", 4, "weight_reps"],
  ["Leg press", "strength", "quadriceps", "machine", 4, "weight_reps"],
  ["Leg extension", "strength", "quadriceps", "machine", 3, "weight_reps"],
  ["Leg curl", "strength", "hamstrings", "machine", 3, "weight_reps"],
  ["Calf raise", "strength", "calves", "machine", 3, "weight_reps"],
  ["Bench press", "strength", "chest", "barbell", 5, "weight_reps"],
  ["Dumbbell bench press", "strength", "chest", "dumbbell", 5, "weight_reps"],
  ["Incline bench press", "strength", "chest", "barbell", 5, "weight_reps"],
  ["Push-up", "strength", "chest", "bodyweight", 4, "reps"],
  ["Overhead press", "strength", "shoulders", "barbell", 4, "weight_reps"],
  ["Dumbbell shoulder press", "strength", "shoulders", "dumbbell", 4, "weight_reps"],
  ["Lateral raise", "strength", "shoulders", "dumbbell", 3, "weight_reps"],
  ["Pull-up", "strength", "back", "bodyweight", 5, "reps"],
  ["Lat pulldown", "strength", "back", "machine", 4, "weight_reps"],
  ["Seated cable row", "strength", "back", "cable", 4, "weight_reps"],
  ["Barbell row", "strength", "back", "barbell", 5, "weight_reps"],
  ["Dumbbell row", "strength", "back", "dumbbell", 4, "weight_reps"],
  ["Face pull", "strength", "shoulders", "cable", 3, "weight_reps"],
  ["Biceps curl", "strength", "biceps", "dumbbell", 3, "weight_reps"],
  ["Hammer curl", "strength", "biceps", "dumbbell", 3, "weight_reps"],
  ["Triceps pushdown", "strength", "triceps", "cable", 3, "weight_reps"],
  ["Triceps extension", "strength", "triceps", "dumbbell", 3, "weight_reps"],
  ["Plank", "strength", "core", "bodyweight", 3, "duration"],
  ["Crunch", "strength", "core", "bodyweight", 3, "reps"],
  ["Hanging leg raise", "strength", "core", "bodyweight", 4, "reps"],
  ["Lunge", "strength", "legs", "bodyweight", 4, "reps"],
  ["Bulgarian split squat", "strength", "legs", "dumbbell", 4, "weight_reps"],
  ["Step-up", "strength", "legs", "dumbbell", 4, "weight_reps"],
  ["Back extension", "strength", "back", "bodyweight", 3, "reps"],
  ["Dips", "strength", "triceps", "bodyweight", 4, "reps"],
  ["Chest fly", "strength", "chest", "dumbbell", 3, "weight_reps"],
  ["Cable crossover", "strength", "chest", "cable", 3, "weight_reps"],
  ["Reverse fly", "strength", "shoulders", "dumbbell", 3, "weight_reps"],
  ["Good morning", "strength", "hamstrings", "barbell", 4, "weight_reps"],
  ["Kettlebell swing", "strength", "glutes", "kettlebell", 6, "weight_reps"],
  ["Walking", "cardio", "full body", "none", 3.5, "distance_duration"],
  ["Brisk walking", "cardio", "full body", "none", 4.3, "distance_duration"],
  ["Hiking", "cardio", "full body", "none", 6, "distance_duration"],
  ["Running", "cardio", "full body", "none", 8, "distance_duration"],
  ["Treadmill running", "cardio", "full body", "treadmill", 8, "distance_duration"],
  ["Cycling", "cardio", "full body", "bike", 8, "distance_duration"],
  ["Stationary cycling", "cardio", "full body", "bike", 7, "duration"],
  ["Swimming", "cardio", "full body", "pool", 6, "distance_duration"],
  ["Rowing machine", "cardio", "full body", "machine", 7, "distance_duration"],
  ["Elliptical", "cardio", "full body", "machine", 5, "duration"],
  ["Jump rope", "cardio", "full body", "rope", 8, "duration"],
  ["Stair climbing", "cardio", "full body", "stairs", 8, "duration"],
  ["Yoga", "flexibility", "full body", "mat", 2.5, "duration"],
  ["Pilates", "flexibility", "full body", "mat", 3, "duration"],
  ["Stretching", "flexibility", "full body", "none", 2.3, "duration"],
  ["Dance", "cardio", "full body", "none", 5, "duration"],
  ["Basketball", "sport", "full body", "ball", 6.5, "duration"],
  ["Soccer", "sport", "full body", "ball", 7, "duration"],
  ["Tennis", "sport", "full body", "racket", 7, "duration"],
  ["Badminton", "sport", "full body", "racket", 5.5, "duration"],
  ["Boxing", "sport", "full body", "gloves", 7, "duration"],
  ["HIIT", "cardio", "full body", "none", 8, "duration"],
].map(([name, category, primaryMuscle, equipment, metValue, tracks]) => ({
  name: String(name),
  category: category as ExerciseSeed["category"],
  primaryMuscle: String(primaryMuscle),
  equipment: String(equipment),
  metValue: Number(metValue),
  tracks: tracks as ExerciseSeed["tracks"],
}));

export async function seedExerciseLibrary(): Promise<number> {
  const db = getDb();
  const existing = await db
    .select({ name: exercises.name })
    .from(exercises)
    .where(isNull(exercises.userId));
  const names = new Set(existing.map((exercise) => exercise.name));
  const missing = exerciseSeeds.filter((exercise) => !names.has(exercise.name));

  if (missing.length > 0) {
    await db.insert(exercises).values(
      missing.map((exercise) => ({
        ...exercise,
        userId: null,
      })),
    );
  }
  return missing.length;
}
