import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

const ownedId = () => uuid("id").defaultRandom().primaryKey();
const userReference = () =>
  text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });
const optionalUserReference = () =>
  text("user_id").references(() => users.id, { onDelete: "cascade" });
const decimal = (name: string, precision = 10, scale = 2) =>
  numeric(name, { precision, scale, mode: "number" });

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => ({
    providerAccount: primaryKey({
      columns: [table.provider, table.providerAccountId],
    }),
  }),
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull().unique(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => ({
    tokenIdentifier: primaryKey({
      columns: [table.identifier, table.token],
    }),
  }),
);

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  sex: text("sex").notNull(),
  birthDate: date("birth_date").notNull(),
  heightCm: decimal("height_cm").notNull(),
  activityLevel: text("activity_level").notNull(),
  goalType: text("goal_type").notNull(),
  targetWeightKg: decimal("target_weight_kg"),
  weeklyRateKg: decimal("weekly_rate_kg").notNull().default(0),
  unitSystem: text("unit_system").notNull().default("metric"),
  timezone: text("timezone").notNull(),
  hideCalories: boolean("hide_calories").notNull().default(false),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  ...timestamps(),
});

export const goals = pgTable(
  "goals",
  {
    id: ownedId(),
    userId: userReference(),
    effectiveFrom: date("effective_from").notNull(),
    caloriesKcal: integer("calories_kcal").notNull(),
    proteinG: integer("protein_g").notNull(),
    carbsG: integer("carbs_g").notNull(),
    fatG: integer("fat_g").notNull(),
    fiberG: integer("fiber_g").notNull(),
    waterMl: integer("water_ml").notNull(),
    steps: integer("steps").notNull(),
    activeMinutes: integer("active_minutes").notNull(),
    sleepMinutes: integer("sleep_minutes").notNull(),
    workoutsPerWeek: integer("workouts_per_week").notNull(),
    ...timestamps(),
  },
  (table) => ({
    ownerEffective: uniqueIndex("goals_user_effective_idx").on(
      table.userId,
      table.effectiveFrom,
    ),
  }),
);

export const foods = pgTable(
  "foods",
  {
    id: ownedId(),
    userId: optionalUserReference(),
    source: text("source").notNull(),
    externalId: text("external_id"),
    barcode: text("barcode"),
    name: text("name").notNull(),
    brand: text("brand"),
    servingSize: decimal("serving_size"),
    servingUnit: text("serving_unit"),
    gramsPerServing: decimal("grams_per_serving"),
    kcal: decimal("kcal"),
    proteinG: decimal("protein_g"),
    carbsG: decimal("carbs_g"),
    fatG: decimal("fat_g"),
    fiberG: decimal("fiber_g"),
    sugarG: decimal("sugar_g"),
    sodiumMg: decimal("sodium_mg"),
    ...timestamps(),
  },
  (table) => ({
    sourceExternal: uniqueIndex("foods_source_external_idx").on(
      table.source,
      table.externalId,
    ),
  }),
);

export const foodEntries = pgTable(
  "food_entries",
  {
    id: ownedId(),
    userId: userReference(),
    loggedOn: date("logged_on").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
    meal: text("meal").notNull(),
    foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    servings: decimal("servings").notNull().default(1),
    kcal: decimal("kcal").notNull().default(0),
    proteinG: decimal("protein_g"),
    carbsG: decimal("carbs_g"),
    fatG: decimal("fat_g"),
    fiberG: decimal("fiber_g"),
    sugarG: decimal("sugar_g"),
    sodiumMg: decimal("sodium_mg"),
    notes: text("notes"),
    ...timestamps(),
  },
  (table) => ({
    ownerDate: index("food_entries_user_logged_on_idx").on(
      table.userId,
      table.loggedOn,
    ),
  }),
);

export const favoriteFoods = pgTable(
  "favorite_foods",
  {
    id: ownedId(),
    userId: userReference(),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    ...timestamps(),
  },
  (table) => ({
    ownerFood: uniqueIndex("favorite_foods_user_food_idx").on(
      table.userId,
      table.foodId,
    ),
  }),
);

export const savedMeals = pgTable("saved_meals", {
  id: ownedId(),
  userId: userReference(),
  name: text("name").notNull(),
  ...timestamps(),
});

export const savedMealItems = pgTable("saved_meal_items", {
  id: ownedId(),
  userId: userReference(),
  savedMealId: uuid("saved_meal_id")
    .notNull()
    .references(() => savedMeals.id, { onDelete: "cascade" }),
  foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  servings: decimal("servings").notNull().default(1),
  kcal: decimal("kcal").notNull().default(0),
  proteinG: decimal("protein_g"),
  carbsG: decimal("carbs_g"),
  fatG: decimal("fat_g"),
  fiberG: decimal("fiber_g"),
  sugarG: decimal("sugar_g"),
  sodiumMg: decimal("sodium_mg"),
  ...timestamps(),
});

export const waterEntries = pgTable(
  "water_entries",
  {
    id: ownedId(),
    userId: userReference(),
    loggedOn: date("logged_on").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
    amountMl: integer("amount_ml").notNull(),
    ...timestamps(),
  },
  (table) => ({
    ownerDate: index("water_entries_user_logged_on_idx").on(
      table.userId,
      table.loggedOn,
    ),
  }),
);

export const exercises = pgTable("exercises", {
  id: ownedId(),
  userId: optionalUserReference(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  primaryMuscle: text("primary_muscle"),
  equipment: text("equipment"),
  metValue: decimal("met_value"),
  tracks: text("tracks").notNull(),
  ...timestamps(),
});

export const workouts = pgTable(
  "workouts",
  {
    id: ownedId(),
    userId: userReference(),
    loggedOn: date("logged_on").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
    type: text("type").notNull(),
    title: text("title"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    durationMin: integer("duration_min"),
    distanceM: integer("distance_m"),
    steps: integer("steps"),
    avgHeartRate: integer("avg_heart_rate"),
    caloriesBurned: integer("calories_burned"),
    caloriesEstimated: boolean("calories_estimated").notNull().default(false),
    perceivedEffort: integer("perceived_effort"),
    notes: text("notes"),
    templateId: uuid("template_id").references(() => workoutTemplates.id, {
      onDelete: "set null",
    }),
    source: text("source"),
    ...timestamps(),
  },
  (table) => ({
    ownerDate: index("workouts_user_logged_on_idx").on(
      table.userId,
      table.loggedOn,
    ),
  }),
);

export const workoutSets = pgTable("workout_sets", {
  id: ownedId(),
  userId: userReference(),
  workoutId: uuid("workout_id")
    .notNull()
    .references(() => workouts.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id").references(() => exercises.id, {
    onDelete: "set null",
  }),
  orderIndex: integer("order").notNull(),
  setNumber: integer("set_number").notNull(),
  reps: integer("reps"),
  weightKg: decimal("weight_kg"),
  durationS: integer("duration_s"),
  distanceM: integer("distance_m"),
  rpe: integer("rpe"),
  isWarmup: boolean("is_warmup").notNull().default(false),
  completed: boolean("completed").notNull().default(false),
  ...timestamps(),
});

export const workoutTemplates = pgTable("workout_templates", {
  id: ownedId(),
  userId: userReference(),
  name: text("name").notNull(),
  notes: text("notes"),
  ...timestamps(),
});

export const workoutTemplateExercises = pgTable("workout_template_exercises", {
  id: ownedId(),
  userId: userReference(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => workoutTemplates.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  orderIndex: integer("order").notNull(),
  targetSets: integer("target_sets").notNull(),
  targetReps: integer("target_reps").notNull(),
  targetWeightKg: decimal("target_weight_kg"),
  restSeconds: integer("rest_seconds"),
  ...timestamps(),
});

export const dailyActivity = pgTable(
  "daily_activity",
  {
    id: ownedId(),
    userId: userReference(),
    loggedOn: date("date").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
    steps: integer("steps").notNull().default(0),
    activeMinutes: integer("active_minutes").notNull().default(0),
    distanceM: integer("distance_m").notNull().default(0),
    source: text("source"),
    ...timestamps(),
  },
  (table) => ({
    ownerDate: uniqueIndex("daily_activity_user_date_idx").on(
      table.userId,
      table.loggedOn,
    ),
  }),
);

export const bodyMeasurements = pgTable(
  "body_measurements",
  {
    id: ownedId(),
    userId: userReference(),
    loggedOn: date("logged_on").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
    weightKg: decimal("weight_kg"),
    bodyFatPct: decimal("body_fat_pct"),
    waistCm: decimal("waist_cm"),
    hipCm: decimal("hip_cm"),
    chestCm: decimal("chest_cm"),
    armCm: decimal("arm_cm"),
    thighCm: decimal("thigh_cm"),
    notes: text("notes"),
    ...timestamps(),
  },
  (table) => ({
    ownerDate: index("body_measurements_user_logged_on_idx").on(
      table.userId,
      table.loggedOn,
    ),
  }),
);

export const vitals = pgTable(
  "vitals",
  {
    id: ownedId(),
    userId: userReference(),
    loggedOn: date("logged_on").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
    kind: text("kind").notNull(),
    valuePrimary: decimal("value_primary").notNull(),
    valueSecondary: decimal("value_secondary"),
    unit: text("unit").notNull(),
    context: text("context"),
    measuredAt: timestamp("measured_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => ({
    ownerDate: index("vitals_user_logged_on_idx").on(
      table.userId,
      table.loggedOn,
    ),
  }),
);

export const sleepEntries = pgTable(
  "sleep_entries",
  {
    id: ownedId(),
    userId: userReference(),
    loggedOn: date("logged_on").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
    sleepDate: date("sleep_date").notNull(),
    bedAt: timestamp("bed_at", { withTimezone: true }),
    wakeAt: timestamp("wake_at", { withTimezone: true }),
    durationMin: integer("duration_min"),
    quality: integer("quality"),
    awakenings: integer("awakenings"),
    notes: text("notes"),
    ...timestamps(),
  },
  (table) => ({
    ownerDate: index("sleep_entries_user_logged_on_idx").on(
      table.userId,
      table.loggedOn,
    ),
  }),
);

export const dailyCheckins = pgTable(
  "daily_checkins",
  {
    id: ownedId(),
    userId: userReference(),
    loggedOn: date("date").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
    mood: integer("mood"),
    energy: integer("energy"),
    stress: integer("stress"),
    soreness: integer("soreness"),
    symptoms: text("symptoms").array().notNull().default([]),
    notes: text("notes"),
    ...timestamps(),
  },
  (table) => ({
    ownerDate: uniqueIndex("daily_checkins_user_date_idx").on(
      table.userId,
      table.loggedOn,
    ),
  }),
);

export const medications = pgTable("medications", {
  id: ownedId(),
  userId: userReference(),
  name: text("name").notNull(),
  dose: text("dose"),
  schedule: text("schedule").notNull(),
  times: text("times").array().notNull().default([]),
  daysOfWeek: integer("days_of_week").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  ...timestamps(),
});

export const medicationLogs = pgTable(
  "medication_logs",
  {
    id: ownedId(),
    userId: userReference(),
    medicationId: uuid("medication_id")
      .notNull()
      .references(() => medications.id, { onDelete: "cascade" }),
    loggedOn: date("logged_on").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps(),
  },
  (table) => ({
    ownerDate: index("medication_logs_user_logged_on_idx").on(
      table.userId,
      table.loggedOn,
    ),
    schedule: uniqueIndex("medication_logs_schedule_idx").on(
      table.userId,
      table.medicationId,
      table.scheduledFor,
    ),
  }),
);

export const reminders = pgTable("reminders", {
  id: ownedId(),
  userId: userReference(),
  kind: text("kind").notNull(),
  time: text("time").notNull(),
  daysOfWeek: integer("days_of_week").array().notNull().default([]),
  enabled: boolean("enabled").notNull().default(true),
  pushSubscriptionId: text("push_subscription_id"),
  ...timestamps(),
});
