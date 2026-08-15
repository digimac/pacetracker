-- Book Resources: gallery of illustrations/charts + downloadable resources for /book/resources
CREATE TABLE IF NOT EXISTS "book_resources" (
  "id" serial PRIMARY KEY,
  "kind" text NOT NULL DEFAULT 'illustration',
  "title" text NOT NULL,
  "caption" text,
  "image_url" text,
  "download_url" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);
