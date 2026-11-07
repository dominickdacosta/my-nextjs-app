CREATE TABLE "strava_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"athlete_id" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"expires_at" integer NOT NULL,
	"scope" text NOT NULL,
	"last_synced_at" timestamp with time zone,
	"history_cursor" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strava_connections_athlete_id_unique" UNIQUE("athlete_id")
);
--> statement-breakpoint
ALTER TABLE "food_entries" ADD COLUMN "nutrition_source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_meal_items" ADD COLUMN "nutrition_source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "avg_pace_sec_per_km" integer;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "elevation_m" integer;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "route_points" jsonb;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "route_polyline" text;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "external_activity_id" text;--> statement-breakpoint
ALTER TABLE "strava_connections" ADD CONSTRAINT "strava_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workouts_source_external_idx" ON "workouts" USING btree ("source","external_activity_id");