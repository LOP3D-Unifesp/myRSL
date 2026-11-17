-- Records identified in the searches, with the screening decision (imported from Parsifal or decided here).

CREATE TABLE public.screening_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  source_database text,
  title text,
  authors text,
  journal text,
  year integer,
  doi text,
  url text,
  abstract text,
  keywords text,
  document_type text,
  status text NOT NULL DEFAULT 'unclassified'
    CHECK (status IN ('accepted', 'rejected', 'duplicate', 'unclassified')),
  -- Code of the protocol criterion that decided it (IC1, EC3...). Kept as text because the
  -- criteria list is rewritten as a whole when the protocol is saved.
  criterion_code text,
  comments text,
  screened_by uuid REFERENCES auth.users(id),
  screened_at timestamptz,
  article_id uuid REFERENCES public.articles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX screening_records_review_status_idx ON public.screening_records (review_id, status);
CREATE INDEX screening_records_article_id_idx ON public.screening_records (article_id);

ALTER TABLE public.screening_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view screening records" ON public.screening_records FOR SELECT TO authenticated
  USING (public.is_review_member(review_id));
CREATE POLICY "Members can insert screening records" ON public.screening_records FOR INSERT TO authenticated
  WITH CHECK (public.is_review_member(review_id));
CREATE POLICY "Members can update screening records" ON public.screening_records FOR UPDATE TO authenticated
  USING (public.is_review_member(review_id)) WITH CHECK (public.is_review_member(review_id));
CREATE POLICY "Owners can delete screening records" ON public.screening_records FOR DELETE TO authenticated
  USING (public.is_review_owner(review_id));

CREATE TRIGGER update_screening_records_updated_at
  BEFORE UPDATE ON public.screening_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
