
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS last_author text,
  ADD COLUMN IF NOT EXISTS universities text,
  ADD COLUMN IF NOT EXISTS publication_place text,
  ADD COLUMN IF NOT EXISTS has_pediatric_participants text,
  ADD COLUMN IF NOT EXISTS statistical_tests_performed text,
  ADD COLUMN IF NOT EXISTS statistical_tests_specified text,
  ADD COLUMN IF NOT EXISTS primary_research_question text;
