CREATE TABLE IF NOT EXISTS "metric_content" (
  "id" serial PRIMARY KEY NOT NULL,
  "metric_key" text NOT NULL UNIQUE,
  "story" text,
  "image_url" text,
  "quote" text,
  "quote_author" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
