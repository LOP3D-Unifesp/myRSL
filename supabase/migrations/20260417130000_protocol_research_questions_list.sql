-- Research questions become an ordered list; the first item is the main question.
ALTER TABLE public.protocols
  ALTER COLUMN research_questions TYPE text[]
  USING CASE
    WHEN research_questions IS NULL OR btrim(research_questions) = '' THEN NULL
    ELSE ARRAY[research_questions]
  END;
