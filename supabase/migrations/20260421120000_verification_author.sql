-- Who completed each verification step, and when.

ALTER TABLE public.articles
  ADD COLUMN verify_peer1_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN verify_peer1_at timestamptz,
  ADD COLUMN verify_peer2_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN verify_peer2_at timestamptz,
  ADD COLUMN verify_qa3_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN verify_qa3_at timestamptz,
  ADD COLUMN verify_qa4_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN verify_qa4_at timestamptz;

-- Set by the database so the record cannot be skipped or forged by the client:
-- turning a step on stamps the current user and time, turning it off clears them.
-- Steps that were already verified keep an empty author (it was never recorded).
CREATE OR REPLACE FUNCTION public.record_verification_author()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
BEGIN
  IF NEW.verify_peer1 AND (TG_OP = 'INSERT' OR NOT OLD.verify_peer1) THEN
    NEW.verify_peer1_by := uid; NEW.verify_peer1_at := now();
  ELSIF NOT NEW.verify_peer1 THEN
    NEW.verify_peer1_by := NULL; NEW.verify_peer1_at := NULL;
  END IF;

  IF NEW.verify_peer2 AND (TG_OP = 'INSERT' OR NOT OLD.verify_peer2) THEN
    NEW.verify_peer2_by := uid; NEW.verify_peer2_at := now();
  ELSIF NOT NEW.verify_peer2 THEN
    NEW.verify_peer2_by := NULL; NEW.verify_peer2_at := NULL;
  END IF;

  IF NEW.verify_qa3 AND (TG_OP = 'INSERT' OR NOT OLD.verify_qa3) THEN
    NEW.verify_qa3_by := uid; NEW.verify_qa3_at := now();
  ELSIF NOT NEW.verify_qa3 THEN
    NEW.verify_qa3_by := NULL; NEW.verify_qa3_at := NULL;
  END IF;

  IF NEW.verify_qa4 AND (TG_OP = 'INSERT' OR NOT OLD.verify_qa4) THEN
    NEW.verify_qa4_by := uid; NEW.verify_qa4_at := now();
  ELSIF NOT NEW.verify_qa4 THEN
    NEW.verify_qa4_by := NULL; NEW.verify_qa4_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_verification_author
  BEFORE INSERT OR UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.record_verification_author();
