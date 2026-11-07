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

export type RunRoutePoint = {
  latitude: number;
  longitude: number;
  recordedAt: string;
  accuracyM: number;
  altitudeM: number | null;
};

export type WorkoutRecord = {
  id: string;
  loggedOn: string;
  loggedAt: string;
  type: "strength" | "cardio" | "walk" | "run" | "other";
  title: string | null;
  durationMin: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  steps: number | null;
  avgHeartRate: number | null;
  caloriesBurned: number | null;
  caloriesEstimated: boolean;
  avgPaceSecPerKm: number | null;
  elevationM: number | null;
  perceivedEffort: number | null;
  notes: string | null;
  routePoints: RunRoutePoint[] | null;
  routePolyline: string | null;
  source: string | null;
  externalActivityId: string | null;
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
