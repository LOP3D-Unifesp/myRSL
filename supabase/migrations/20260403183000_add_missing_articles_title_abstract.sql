-- Ensure compatibility with frontend selects/imports on fresh projects.
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS abstract text;
