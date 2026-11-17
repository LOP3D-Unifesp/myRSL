-- Reviewer 1 / Reviewer 2 per review, who may change each verification step, and independent
-- quality assessments per reviewer (articles.qa_* stays as the final, consensus assessment).

ALTER TABLE public.review_members
  ADD COLUMN reviewer_slot smallint CHECK (reviewer_slot IN (1, 2));
CREATE UNIQUE INDEX review_members_slot_idx ON public.review_members (review_id, reviewer_slot)
  WHERE reviewer_slot IS NOT NULL;

CREATE OR REPLACE FUNCTION public.my_reviewer_slot(rid uuid)
RETURNS smallint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.reviewer_slot FROM public.review_members m
  WHERE m.review_id = rid AND m.user_id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.set_reviewer_slot(p_review_id uuid, p_user_id uuid, p_slot smallint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_review_owner(p_review_id) THEN
    RAISE EXCEPTION 'Only the review owner can assign reviewers';
  END IF;
  IF p_slot IS NOT NULL AND p_slot NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Reviewer must be 1 or 2';
  END IF;
  IF p_slot IS NOT NULL THEN
    UPDATE public.review_members SET reviewer_slot = NULL
    WHERE review_id = p_review_id AND reviewer_slot = p_slot AND user_id <> p_user_id;
  END IF;
  UPDATE public.review_members SET reviewer_slot = p_slot
  WHERE review_id = p_review_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person is not a member of this review';
  END IF;
END;
$$;

DROP FUNCTION public.list_review_members(uuid);
CREATE FUNCTION public.list_review_members(p_review_id uuid)
RETURNS TABLE (user_id uuid, role text, email text, full_name text, reviewer_slot smallint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_review_member(p_review_id) THEN
    RAISE EXCEPTION 'Not a member of this review';
  END IF;
  RETURN QUERY
  SELECT m.user_id, m.role, u.email::text, p.full_name, m.reviewer_slot
  FROM public.review_members m
  JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.review_id = p_review_id
  ORDER BY m.reviewer_slot NULLS LAST, m.role, u.email;
END;
$$;

REVOKE ALL ON FUNCTION public.my_reviewer_slot(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_reviewer_slot(uuid, uuid, smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_review_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_reviewer_slot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_reviewer_slot(uuid, uuid, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_review_members(uuid) TO authenticated;

-- Verification steps: Peer 1 and QA P1 belong to reviewer 1, Peer 2 and QA P2 to reviewer 2.
-- Only that reviewer (or an owner) may turn a step on or off. Stamps keep recording the real user.
CREATE OR REPLACE FUNCTION public.record_verification_author()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
  my_slot smallint;
  is_owner boolean := false;
BEGIN
  IF uid IS NOT NULL AND TG_OP = 'UPDATE' THEN
    SELECT m.reviewer_slot, (m.role = 'owner') INTO my_slot, is_owner
    FROM public.review_members m WHERE m.review_id = NEW.review_id AND m.user_id = uid;

    IF (NEW.verify_peer1 IS DISTINCT FROM OLD.verify_peer1 OR NEW.verify_qa3 IS DISTINCT FROM OLD.verify_qa3)
       AND NOT (coalesce(is_owner, false) OR my_slot = 1) THEN
      RAISE EXCEPTION 'Only reviewer 1 can change Peer 1 and QA P1 verification';
    END IF;
    IF (NEW.verify_peer2 IS DISTINCT FROM OLD.verify_peer2 OR NEW.verify_qa4 IS DISTINCT FROM OLD.verify_qa4)
       AND NOT (coalesce(is_owner, false) OR my_slot = 2) THEN
      RAISE EXCEPTION 'Only reviewer 2 can change Peer 2 and QA P2 verification';
    END IF;
  END IF;

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

-- Independent quality assessments, one per article and reviewer.
CREATE TABLE public.article_qa_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  reviewer_slot smallint NOT NULL CHECK (reviewer_slot IN (1, 2)),
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  qa_q1 text CHECK (qa_q1 IN ('Yes', 'Partial', 'No')),
  qa_q2 text CHECK (qa_q2 IN ('Yes', 'Partial', 'No')),
  qa_q3 text CHECK (qa_q3 IN ('Yes', 'Partial', 'No')),
  qa_q4 text CHECK (qa_q4 IN ('Yes', 'Partial', 'No')),
  qa_q5 text CHECK (qa_q5 IN ('Yes', 'Partial', 'No')),
  qa_q6 text CHECK (qa_q6 IN ('Yes', 'Partial', 'No')),
  qa_q7 text CHECK (qa_q7 IN ('Yes', 'Partial', 'No')),
  qa_q8 text CHECK (qa_q8 IN ('Yes', 'Partial', 'No')),
  qa_q9 text CHECK (qa_q9 IN ('Yes', 'Partial', 'No')),
  qa_q10 text CHECK (qa_q10 IN ('Yes', 'Partial', 'No')),
  qa_score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, reviewer_slot)
);
CREATE INDEX article_qa_assessments_review_idx ON public.article_qa_assessments (review_id);

ALTER TABLE public.article_qa_assessments ENABLE ROW LEVEL SECURITY;

-- Blind until finished: a reviewer sees the other assessment only after marking their own QA step
-- as verified. An owner without a reviewer slot sees everything.
CREATE OR REPLACE FUNCTION public.can_view_qa_assessment(p_review_id uuid, p_article_id uuid, p_slot smallint)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_slot smallint := public.my_reviewer_slot(p_review_id);
  finished boolean;
BEGIN
  IF NOT public.is_review_member(p_review_id) THEN
    RETURN false;
  END IF;
  IF my_slot IS NULL THEN
    RETURN public.is_review_owner(p_review_id);
  END IF;
  IF my_slot = p_slot THEN
    RETURN true;
  END IF;
  SELECT CASE my_slot WHEN 1 THEN a.verify_qa3 ELSE a.verify_qa4 END INTO finished
  FROM public.articles a WHERE a.id = p_article_id;
  RETURN coalesce(finished, false);
END;
$$;
REVOKE ALL ON FUNCTION public.can_view_qa_assessment(uuid, uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_qa_assessment(uuid, uuid, smallint) TO authenticated;

CREATE POLICY "Reviewers view allowed QA assessments" ON public.article_qa_assessments FOR SELECT TO authenticated
  USING (public.can_view_qa_assessment(review_id, article_id, reviewer_slot));
CREATE POLICY "Reviewers write their own QA assessment" ON public.article_qa_assessments FOR INSERT TO authenticated
  WITH CHECK (public.is_review_member(review_id) AND (public.is_review_owner(review_id) OR reviewer_slot = public.my_reviewer_slot(review_id)));
CREATE POLICY "Reviewers update their own QA assessment" ON public.article_qa_assessments FOR UPDATE TO authenticated
  USING (public.is_review_member(review_id) AND (public.is_review_owner(review_id) OR reviewer_slot = public.my_reviewer_slot(review_id)))
  WITH CHECK (public.is_review_member(review_id) AND (public.is_review_owner(review_id) OR reviewer_slot = public.my_reviewer_slot(review_id)));
CREATE POLICY "Owners delete QA assessments" ON public.article_qa_assessments FOR DELETE TO authenticated
  USING (public.is_review_owner(review_id));

-- review_id always follows the article, and the author defaults to the current user.
CREATE OR REPLACE FUNCTION public.set_qa_assessment_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  SELECT a.review_id INTO NEW.review_id FROM public.articles a WHERE a.id = NEW.article_id;
  IF NEW.reviewer_id IS NULL THEN
    NEW.reviewer_id := (SELECT auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_qa_assessment_defaults
  BEFORE INSERT ON public.article_qa_assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_qa_assessment_defaults();
CREATE TRIGGER update_article_qa_assessments_updated_at
  BEFORE UPDATE ON public.article_qa_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
