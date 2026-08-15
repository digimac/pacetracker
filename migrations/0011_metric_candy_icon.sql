-- Candy icon per core metric, shown next to the metric on Today/Dashboard/History
ALTER TABLE "metric_content" ADD COLUMN IF NOT EXISTS "candy_icon_url" text;
