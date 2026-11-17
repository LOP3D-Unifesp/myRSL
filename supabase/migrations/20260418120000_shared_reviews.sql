-- Shared reviews: articles, protocols and PDFs belong to a review; every member can read and write.

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.review_members (
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'reviewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);
CREATE INDEX review_members_user_id_idx ON public.review_members (user_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_members ENABLE ROW LEVEL SECURITY;

-- Membership helpers (SECURITY DEFINER so policies on review_members do not recurse).
CREATE OR REPLACE FUNCTION public.is_review_member(rid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.review_members m
    WHERE m.review_id = rid AND m.user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_review_owner(rid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.review_members m
    WHERE m.review_id = rid AND m.user_id = (SELECT auth.uid()) AND m.role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.is_review_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_review_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_review_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_review_owner(uuid) TO authenticated;

-- Review columns, backfilled with one review per existing user.
ALTER TABLE public.articles ADD COLUMN review_id uuid REFERENCES public.reviews(id) ON DELETE CASCADE;
ALTER TABLE public.protocols ADD COLUMN review_id uuid REFERENCES public.reviews(id) ON DELETE CASCADE;
ALTER TABLE public.protocol_databases ADD COLUMN review_id uuid REFERENCES public.reviews(id) ON DELETE CASCADE;

DO $$
DECLARE
  u uuid;
  rid uuid;
BEGIN
  FOR u IN
    SELECT user_id FROM public.articles
    UNION SELECT user_id FROM public.protocols
    UNION SELECT user_id FROM public.protocol_databases
  LOOP
    INSERT INTO public.reviews (name, created_by) VALUES ('My review', u) RETURNING id INTO rid;
    INSERT INTO public.review_members (review_id, user_id, role) VALUES (rid, u, 'owner');
    UPDATE public.articles SET review_id = rid WHERE user_id = u;
    UPDATE public.protocols SET review_id = rid WHERE user_id = u;
    UPDATE public.protocol_databases SET review_id = rid WHERE user_id = u;
  END LOOP;
END $$;

ALTER TABLE public.articles ALTER COLUMN review_id SET NOT NULL;
ALTER TABLE public.protocols ALTER COLUMN review_id SET NOT NULL;
ALTER TABLE public.protocol_databases ALTER COLUMN review_id SET NOT NULL;

CREATE INDEX articles_review_id_idx ON public.articles (review_id);

ALTER TABLE public.protocols DROP CONSTRAINT protocols_user_id_key;
ALTER TABLE public.protocols ADD CONSTRAINT protocols_review_id_key UNIQUE (review_id);
ALTER TABLE public.protocol_databases DROP CONSTRAINT protocol_databases_user_id_name_key;
ALTER TABLE public.protocol_databases ADD CONSTRAINT protocol_databases_review_id_name_key UNIQUE (review_id, name);

-- Replace per-user policies with membership policies.
DROP POLICY "Users can view own articles" ON public.articles;
DROP POLICY "Users can insert own articles" ON public.articles;
DROP POLICY "Users can update own articles" ON public.articles;
DROP POLICY "Users can delete own articles" ON public.articles;

CREATE POLICY "Members can view articles" ON public.articles FOR SELECT TO authenticated
  USING (public.is_review_member(review_id));
CREATE POLICY "Members can insert articles" ON public.articles FOR INSERT TO authenticated
  WITH CHECK (public.is_review_member(review_id) AND user_id = (SELECT auth.uid()));
CREATE POLICY "Members can update articles" ON public.articles FOR UPDATE TO authenticated
  USING (public.is_review_member(review_id))
  WITH CHECK (public.is_review_member(review_id));
CREATE POLICY "Owners can delete articles" ON public.articles FOR DELETE TO authenticated
  USING (public.is_review_owner(review_id));

DROP POLICY "Users can view own protocol" ON public.protocols;
DROP POLICY "Users can insert own protocol" ON public.protocols;
DROP POLICY "Users can update own protocol" ON public.protocols;
DROP POLICY "Users can delete own protocol" ON public.protocols;

CREATE POLICY "Members can view protocol" ON public.protocols FOR SELECT TO authenticated
  USING (public.is_review_member(review_id));
CREATE POLICY "Members can insert protocol" ON public.protocols FOR INSERT TO authenticated
  WITH CHECK (public.is_review_member(review_id) AND user_id = (SELECT auth.uid()));
CREATE POLICY "Members can update protocol" ON public.protocols FOR UPDATE TO authenticated
  USING (public.is_review_member(review_id))
  WITH CHECK (public.is_review_member(review_id));
CREATE POLICY "Owners can delete protocol" ON public.protocols FOR DELETE TO authenticated
  USING (public.is_review_owner(review_id));

DROP POLICY "Users can view own protocol databases" ON public.protocol_databases;
DROP POLICY "Users can insert own protocol databases" ON public.protocol_databases;
DROP POLICY "Users can update own protocol databases" ON public.protocol_databases;
DROP POLICY "Users can delete own protocol databases" ON public.protocol_databases;

CREATE POLICY "Members can view protocol databases" ON public.protocol_databases FOR SELECT TO authenticated
  USING (public.is_review_member(review_id));
CREATE POLICY "Members can insert protocol databases" ON public.protocol_databases FOR INSERT TO authenticated
  WITH CHECK (public.is_review_member(review_id) AND user_id = (SELECT auth.uid()));
CREATE POLICY "Members can update protocol databases" ON public.protocol_databases FOR UPDATE TO authenticated
  USING (public.is_review_member(review_id))
  WITH CHECK (public.is_review_member(review_id));
CREATE POLICY "Members can delete protocol databases" ON public.protocol_databases FOR DELETE TO authenticated
  USING (public.is_review_member(review_id));

-- Reviews and memberships are changed only through the RPCs below (or by owners where noted).
CREATE POLICY "Members can view reviews" ON public.reviews FOR SELECT TO authenticated
  USING (public.is_review_member(id));
CREATE POLICY "Owners can update reviews" ON public.reviews FOR UPDATE TO authenticated
  USING (public.is_review_owner(id))
  WITH CHECK (public.is_review_owner(id));
CREATE POLICY "Owners can delete reviews" ON public.reviews FOR DELETE TO authenticated
  USING (public.is_review_owner(id));

CREATE POLICY "Members can view memberships" ON public.review_members FOR SELECT TO authenticated
  USING (public.is_review_member(review_id));
CREATE POLICY "Owners can remove other members" ON public.review_members FOR DELETE TO authenticated
  USING (public.is_review_owner(review_id) AND user_id <> (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.create_review(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
  uid uuid := (SELECT auth.uid());
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Review name is required';
  END IF;
  INSERT INTO public.reviews (name, created_by) VALUES (btrim(p_name), uid) RETURNING id INTO rid;
  INSERT INTO public.review_members (review_id, user_id, role) VALUES (rid, uid, 'owner');
  RETURN rid;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_review_member(p_review_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid;
BEGIN
  IF NOT public.is_review_owner(p_review_id) THEN
    RAISE EXCEPTION 'Only the review owner can add members';
  END IF;
  SELECT id INTO target FROM auth.users WHERE lower(email) = lower(btrim(p_email)) LIMIT 1;
  IF target IS NULL THEN
    RAISE EXCEPTION 'Could not add this member. Check the e-mail and make sure the person has signed up.';
  END IF;
  INSERT INTO public.review_members (review_id, user_id, role)
  VALUES (p_review_id, target, 'reviewer')
  ON CONFLICT (review_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_review_members(p_review_id uuid)
RETURNS TABLE (user_id uuid, role text, email text, full_name text)
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
  SELECT m.user_id, m.role, u.email::text, p.full_name
  FROM public.review_members m
  JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.review_id = p_review_id
  ORDER BY m.role, u.email;
END;
$$;

REVOKE ALL ON FUNCTION public.create_review(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_review_member(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_review_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_review(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_review_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_review_members(uuid) TO authenticated;

-- PDFs stay in <uploader id>/ folders; any member of the article's review can read them.
DROP POLICY "Users can read own PDFs" ON storage.objects;
CREATE POLICY "Members can read review PDFs" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'research-pdfs'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.articles a
      WHERE a.pdf_url = storage.objects.name AND public.is_review_member(a.review_id)
    )
  )
);

-- Older clients insert articles without review_id; default to the user's first review.
CREATE OR REPLACE FUNCTION public.set_default_review_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.review_id IS NULL THEN
    SELECT m.review_id INTO NEW.review_id
    FROM public.review_members m
    WHERE m.user_id = (SELECT auth.uid())
    ORDER BY m.created_at
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_articles_default_review_id
  BEFORE INSERT ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_default_review_id();
