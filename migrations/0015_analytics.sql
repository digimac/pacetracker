-- GA measurement for Simple mode. Applied at startup by server/index.ts
-- (which also backfills analytics_counted_at for pre-existing days, one time only).
ALTER TABLE "daily_entries" ADD COLUMN IF NOT EXISTS "analytics_counted_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_app_mode" text;
