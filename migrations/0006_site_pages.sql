CREATE TABLE IF NOT EXISTS "site_pages" (
  "id" serial PRIMARY KEY NOT NULL,
  "page_key" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "subtitle" text,
  "hero_image_url" text,
  "body" text,
  "sections" text,
  "contact_email" text,
  "social_links" text,
  "cta_label" text,
  "cta_url" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Seed default content for the three pages
INSERT INTO "site_pages" ("page_key", "title", "subtitle", "body", "updated_at")
VALUES
  ('story', 'The Story of Momentum', 'The book, the idea, and the metrics that drive it', '', now()),
  ('tracking', 'Daily Tracking', 'How to use Sweet Momentum to build winning habits', '', now()),
  ('connect', 'Connect', 'Reach out, share feedback, and join the community', '', now())
ON CONFLICT ("page_key") DO NOTHING;
