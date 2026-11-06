export type WorkoutSetRecord = {
  id: string;
  workoutId: string;
  exerciseId: string | null;
  exerciseName: string | null;
  orderIndex: number;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  durationS: number | null;
  distanceM: number | null;
  rpe: number | null;
  isWarmup: boolean;
  completed: boolean;
};

export type WorkoutRecord = {
  id: string;
  loggedOn: string;
  loggedAt: string;
  type: "strength" | "cardio" | "walk" | "run" | "other";
  title: string | null;
  durationMin: number | null;
  distanceM: number | null;
  steps: number | null;
  avgHeartRate: number | null;
  caloriesBurned: number | null;
  caloriesEstimated: boolean;
  perceivedEffort: number | null;
  notes: string | null;
  sets: WorkoutSetRecord[];
};

export type ExerciseSearchResult = {
  id: string;
  name: string;
  category: string;
  primaryMuscle: string | null;
  equipment: string | null;
  tracks: string;
};

export type TrainingType = WorkoutRecord["type"];
