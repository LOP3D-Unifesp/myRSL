-- Review protocol (per user) and the database each article came from.

CREATE TABLE public.protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  research_questions text,
  period_from integer,
  period_to integer,
  languages text[],
  extraction_notes text,
  inclusion_criteria text[],
  exclusion_criteria text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.protocol_databases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  search_string text,
  searched_at date,
  results_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_databases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own protocol" ON public.protocols FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own protocol" ON public.protocols FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own protocol" ON public.protocols FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own protocol" ON public.protocols FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own protocol databases" ON public.protocol_databases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own protocol databases" ON public.protocol_databases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own protocol databases" ON public.protocol_databases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own protocol databases" ON public.protocol_databases FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_protocols_updated_at
  BEFORE UPDATE ON public.protocols
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_protocol_databases_updated_at
  BEFORE UPDATE ON public.protocol_databases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS source_database text;

-- Backfill from the study_id prefix (e.g. "SCOPUS_22 / Jiang et al., 2017").
UPDATE public.articles
SET source_database = CASE upper(substring(study_id from '^\s*([A-Za-z]+)_'))
  WHEN 'SCOPUS' THEN 'Scopus'
  WHEN 'IEEE' THEN 'IEEE'
  WHEN 'ACM' THEN 'ACM'
  WHEN 'PUBMED' THEN 'PubMed'
END
WHERE source_database IS NULL AND study_id IS NOT NULL;

INSERT INTO public.protocol_databases (user_id, name)
SELECT DISTINCT user_id, source_database
FROM public.articles
WHERE source_database IS NOT NULL
ON CONFLICT (user_id, name) DO NOTHING;
