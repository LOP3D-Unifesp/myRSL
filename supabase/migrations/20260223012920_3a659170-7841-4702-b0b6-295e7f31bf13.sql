
-- Add new columns to articles table matching the schema
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS prosthesis_level text,
  ADD COLUMN IF NOT EXISTS feedback_modalities text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS manufacturing_method text,
  ADD COLUMN IF NOT EXISTS growth_accommodation text,
  ADD COLUMN IF NOT EXISTS usage_outcomes text,
  ADD COLUMN IF NOT EXISTS research_questions text[] DEFAULT '{}'::text[];
