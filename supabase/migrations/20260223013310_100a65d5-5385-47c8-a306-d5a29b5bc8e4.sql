
-- Convert setting from text to text array for Select Many support
ALTER TABLE public.articles
  ALTER COLUMN setting TYPE text[] USING CASE WHEN setting IS NULL THEN '{}'::text[] ELSE ARRAY[setting] END,
  ALTER COLUMN setting SET DEFAULT '{}'::text[];
