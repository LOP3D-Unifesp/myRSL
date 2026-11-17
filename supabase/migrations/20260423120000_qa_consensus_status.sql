-- QA consensus status of each article, kept in articles.qa_consensus_status so it can be listed and
-- filtered without exposing the reviewers' answers (those stay blind until each reviewer finishes).
--   not_assessed    no reviewer has a complete assessment
--   awaiting_second one reviewer has a complete assessment
--   needs_consensus both have one and the final QA still has undecided items
--   consensus       both have one and the final QA is fully decided

ALTER TABLE public.articles
  ADD COLUMN qa_consensus_status text NOT NULL DEFAULT 'not_assessed'
  CHECK (qa_consensus_status IN ('not_assessed', 'awaiting_second', 'needs_consensus', 'consensus'));

CREATE INDEX articles_qa_consensus_status_idx ON public.articles (review_id, qa_consensus_status);

CREATE OR REPLACE FUNCTION public.qa_consensus_status_of(p_article_id uuid, p_final_answered integer)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  complete_count integer;
BEGIN
  SELECT count(*) INTO complete_count
  FROM public.article_qa_assessments a
  WHERE a.article_id = p_article_id
    AND num_nonnulls(a.qa_q1, a.qa_q2, a.qa_q3, a.qa_q4, a.qa_q5, a.qa_q6, a.qa_q7, a.qa_q8, a.qa_q9, a.qa_q10) = 10;

  RETURN CASE
    WHEN complete_count >= 2 AND p_final_answered = 10 THEN 'consensus'
    WHEN complete_count >= 2 THEN 'needs_consensus'
    WHEN complete_count = 1 THEN 'awaiting_second'
    ELSE 'not_assessed'
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.qa_consensus_status_of(uuid, integer) FROM PUBLIC, anon;

-- Recomputed whenever the article (its final QA) is written ...
CREATE OR REPLACE FUNCTION public.set_article_qa_consensus_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.qa_consensus_status := public.qa_consensus_status_of(
    NEW.id,
    num_nonnulls(NEW.qa_q1, NEW.qa_q2, NEW.qa_q3, NEW.qa_q4, NEW.qa_q5, NEW.qa_q6, NEW.qa_q7, NEW.qa_q8, NEW.qa_q9, NEW.qa_q10)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_article_qa_consensus_status
  BEFORE INSERT OR UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_article_qa_consensus_status();

-- ... and whenever an assessment is written, by touching the article so the trigger above runs.
CREATE OR REPLACE FUNCTION public.refresh_article_qa_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid := coalesce(NEW.article_id, OLD.article_id);
BEGIN
  UPDATE public.articles SET qa_consensus_status = qa_consensus_status WHERE id = target;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_refresh_article_qa_status
  AFTER INSERT OR UPDATE OR DELETE ON public.article_qa_assessments
  FOR EACH ROW EXECUTE FUNCTION public.refresh_article_qa_status();

-- Backfill: touch every article so the trigger computes its status.
UPDATE public.articles SET qa_consensus_status = qa_consensus_status;
