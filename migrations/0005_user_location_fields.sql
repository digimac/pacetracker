-- Add city, region, and country columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "region" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "country" text;
