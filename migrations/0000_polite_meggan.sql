CREATE TABLE "custom_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"emoji" text DEFAULT '⭐',
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "daily_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"entry_date" date NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"metric_key" text NOT NULL,
	"metric_label" text NOT NULL,
	"rating" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"plan" text DEFAULT 'free',
	"status" text DEFAULT 'inactive',
	"current_period_end" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"wake_time" text DEFAULT '06:00',
	"sleep_time" text DEFAULT '22:00',
	"work_start_time" text DEFAULT '09:00',
	"work_end_time" text DEFAULT '17:00',
	"timezone" text DEFAULT 'America/New_York',
	"daily_goal" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_schedule_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
