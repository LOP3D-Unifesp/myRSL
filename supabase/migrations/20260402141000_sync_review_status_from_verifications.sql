ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS review_status text;

ALTER TABLE public.articles
  ALTER COLUMN review_status SET DEFAULT 'pending';

UPDATE public.articles
SET review_status = COALESCE(review_status, 'pending');

ALTER TABLE public.articles
  ALTER COLUMN review_status SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_review_status_from_verifications()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.verify_peer1 AND NEW.verify_peer2 AND NEW.verify_qa3 AND NEW.verify_qa4 THEN
    NEW.review_status := 'verified';
  ELSE
    NEW.review_status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_review_status_on_articles ON public.articles;

CREATE TRIGGER trg_sync_review_status_on_articles
BEFORE INSERT OR UPDATE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.sync_review_status_from_verifications();

UPDATE public.articles
SET review_status = CASE
  WHEN verify_peer1 AND verify_peer2 AND verify_qa3 AND verify_qa4 THEN 'verified'
  ELSE 'pending'
END;
