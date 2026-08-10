-- Rolling 6-month free trial for Pro access
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_reminder_sent_at" timestamp;

-- Backdate existing users without a trial so nobody is excluded from the promo
UPDATE "users" SET "trial_ends_at" = now() + interval '6 months' WHERE "trial_ends_at" IS NULL;
