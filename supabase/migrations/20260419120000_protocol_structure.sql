-- Structured protocol: overview fields, coded criteria, research questions and the QA checklist.

ALTER TABLE public.protocols
  ADD COLUMN title text,
  ADD COLUMN objective text,
  ADD COLUMN picoc jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN search_string text;

ALTER TABLE public.protocol_databases ADD COLUMN url text;

CREATE TABLE public.protocol_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('inclusion', 'exclusion')),
  code text NOT NULL,
  text text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  UNIQUE (review_id, code)
);

CREATE TABLE public.protocol_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  text text,
  is_main boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  UNIQUE (review_id, code)
);

CREATE TABLE public.protocol_qa_items (
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot ~ '^qa_q([1-9]|10)$'),
  label text NOT NULL,
  description text,
  PRIMARY KEY (review_id, slot)
);

ALTER TABLE public.protocol_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_qa_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view criteria" ON public.protocol_criteria FOR SELECT TO authenticated
  USING (public.is_review_member(review_id));
CREATE POLICY "Members can insert criteria" ON public.protocol_criteria FOR INSERT TO authenticated
  WITH CHECK (public.is_review_member(review_id));
CREATE POLICY "Members can update criteria" ON public.protocol_criteria FOR UPDATE TO authenticated
  USING (public.is_review_member(review_id)) WITH CHECK (public.is_review_member(review_id));
CREATE POLICY "Members can delete criteria" ON public.protocol_criteria FOR DELETE TO authenticated
  USING (public.is_review_member(review_id));

CREATE POLICY "Members can view questions" ON public.protocol_questions FOR SELECT TO authenticated
  USING (public.is_review_member(review_id));
CREATE POLICY "Members can insert questions" ON public.protocol_questions FOR INSERT TO authenticated
  WITH CHECK (public.is_review_member(review_id));
CREATE POLICY "Members can update questions" ON public.protocol_questions FOR UPDATE TO authenticated
  USING (public.is_review_member(review_id)) WITH CHECK (public.is_review_member(review_id));
CREATE POLICY "Members can delete questions" ON public.protocol_questions FOR DELETE TO authenticated
  USING (public.is_review_member(review_id));

CREATE POLICY "Members can view QA items" ON public.protocol_qa_items FOR SELECT TO authenticated
  USING (public.is_review_member(review_id));
CREATE POLICY "Members can insert QA items" ON public.protocol_qa_items FOR INSERT TO authenticated
  WITH CHECK (public.is_review_member(review_id));
CREATE POLICY "Members can update QA items" ON public.protocol_qa_items FOR UPDATE TO authenticated
  USING (public.is_review_member(review_id)) WITH CHECK (public.is_review_member(review_id));
CREATE POLICY "Members can delete QA items" ON public.protocol_qa_items FOR DELETE TO authenticated
  USING (public.is_review_member(review_id));

-- The list columns on protocols are replaced by the tables above (they held no data yet).
ALTER TABLE public.protocols
  DROP COLUMN inclusion_criteria,
  DROP COLUMN exclusion_criteria,
  DROP COLUMN research_questions;

-- Defaults for existing reviews: the research questions and QA checklist the app has used so far,
-- so stored article answers (e.g. "Q2 – Technology and Design", qa_q1..qa_q10) keep their meaning.
INSERT INTO public.protocol_questions (review_id, code, label, is_main, position)
SELECT r.id, q.code, q.label, q.code = 'Q1', q.position
FROM public.reviews r
CROSS JOIN (VALUES
  ('Q1', 'Main (Geral)', 1),
  ('Q2', 'Technology and Design', 2),
  ('Q3', 'Usability and Acceptance', 3),
  ('Q4', 'Functional and Clinical Outcomes', 4),
  ('Q5', 'Pediatric-Specific Needs and Gaps', 5),
  ('Q6', 'Technical Challenges and Barriers', 6)
) AS q(code, label, position);

INSERT INTO public.protocol_qa_items (review_id, slot, label, description)
SELECT r.id, q.slot, q.label, q.description
FROM public.reviews r
CROSS JOIN (VALUES
  ('qa_q1', 'Q1 - Objective, Scope, and Justification', 'Defines objective, scope, and engineering justification.'),
  ('qa_q2', 'Q2 - Reproducible Configuration and Protocol', 'Configuration, tasks/protocol, duration/sessions, and conditions are detailed enough to replicate.'),
  ('qa_q3', 'Q3 - Data Collection and Processing Pipeline', 'What was collected, how, instruments, frequency/duration, and processing pipeline are clearly described.'),
  ('qa_q4', 'Q4 - Metrics and Statistical Analysis', 'Operational metrics are defined and statistical analysis is applied to results.'),
  ('qa_q5', 'Q5 - Variability and Limitations', 'Discusses variability, bias, sample size, generalization, and technical limitations.'),
  ('qa_q6', 'Q6 - Pediatric Population Definition', 'Pediatric population is clearly characterized by age range or clinical context.'),
  ('qa_q7', 'Q7 - Sensor and Hardware Specification', 'Sensor type/model, architecture, sampling/filtering, and commercial availability are specified.'),
  ('qa_q8', 'Q8 - Pediatric Physiology Considerations', 'Design considers strength, fatigue, motor variability, weaker sEMG, or neuromuscular maturation.'),
  ('qa_q9', 'Q9 - Growth Accommodation Strategy', 'Provides and validates a technical solution for growth adaptation (parametric/modular/adjustable fitting).'),
  ('qa_q10', 'Q10 - Challenge-Solution Validation', 'Proposes and validates with data a solution to a specific technical challenge.')
) AS q(slot, label, description);

-- Replaces the criteria, questions and QA checklist of a review in one transaction.
-- SECURITY INVOKER: the RLS policies above decide who may write.
CREATE OR REPLACE FUNCTION public.save_protocol_lists(
  p_review_id uuid,
  p_criteria jsonb,
  p_questions jsonb,
  p_qa jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.protocol_criteria WHERE review_id = p_review_id;
  INSERT INTO public.protocol_criteria (review_id, kind, code, text, position)
  SELECT p_review_id, c.kind, c.code, c.text, c.position
  FROM jsonb_to_recordset(p_criteria) AS c(kind text, code text, text text, position integer);

  DELETE FROM public.protocol_questions WHERE review_id = p_review_id;
  INSERT INTO public.protocol_questions (review_id, code, label, text, is_main, position)
  SELECT p_review_id, q.code, q.label, q.text, coalesce(q.is_main, false), q.position
  FROM jsonb_to_recordset(p_questions) AS q(code text, label text, text text, is_main boolean, position integer);

  DELETE FROM public.protocol_qa_items WHERE review_id = p_review_id;
  INSERT INTO public.protocol_qa_items (review_id, slot, label, description)
  SELECT p_review_id, i.slot, i.label, i.description
  FROM jsonb_to_recordset(p_qa) AS i(slot text, label text, description text);
END;
$$;

REVOKE ALL ON FUNCTION public.save_protocol_lists(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_protocol_lists(uuid, jsonb, jsonb, jsonb) TO authenticated;
