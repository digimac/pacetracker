-- Migration: add prompt column to metric_content
-- prompt = longer "metrics prompt" shown on the Today scoring page per metric
ALTER TABLE metric_content ADD COLUMN IF NOT EXISTS prompt text;
