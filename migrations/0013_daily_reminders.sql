-- Automatic daily scoring reminder (email OR sms, never both) + send log.
-- Applied at startup by server/index.ts (same belt-and-suspenders pattern as 0010–0012).
ALTER TABLE "user_schedule" ADD COLUMN IF NOT EXISTS "reminder_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "user_schedule" ADD COLUMN IF NOT EXISTS "reminder_method" text NOT NULL DEFAULT 'email';
ALTER TABLE "user_schedule" ADD COLUMN IF NOT EXISTS "reminder_time" text NOT NULL DEFAULT '08:00';
ALTER TABLE "user_schedule" ADD COLUMN IF NOT EXISTS "timezone_confirmed" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "reminder_log" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL,
  "kind" text NOT NULL DEFAULT 'daily_score',
  "local_date" date NOT NULL,
  "channel" text NOT NULL,
  "destination" text,
  "status" text NOT NULL DEFAULT 'sending',
  "provider_id" text,
  "error" text,
  "timezone" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "reminder_log_user_kind_date_unique" ON "reminder_log" ("user_id", "kind", "local_date");
CREATE INDEX IF NOT EXISTS "reminder_log_created_at_idx" ON "reminder_log" ("created_at");
