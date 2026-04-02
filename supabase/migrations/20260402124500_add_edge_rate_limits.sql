CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  endpoint text NOT NULL,
  subject_key text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address inet,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (endpoint, subject_key, window_start)
);

CREATE INDEX IF NOT EXISTS edge_rate_limits_updated_at_idx
  ON public.edge_rate_limits (updated_at);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.edge_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  p_endpoint text,
  p_subject_key text,
  p_user_id uuid,
  p_ip inet,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF p_limit <= 0 OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;

  v_window_start := to_timestamp(floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.edge_rate_limits (
    endpoint,
    subject_key,
    user_id,
    ip_address,
    window_start,
    request_count,
    updated_at
  )
  VALUES (
    p_endpoint,
    p_subject_key,
    p_user_id,
    p_ip,
    v_window_start,
    1,
    v_now
  )
  ON CONFLICT (endpoint, subject_key, window_start)
  DO UPDATE
  SET
    request_count = public.edge_rate_limits.request_count + 1,
    updated_at = EXCLUDED.updated_at
  RETURNING request_count INTO v_count;

  DELETE FROM public.edge_rate_limits
  WHERE updated_at < v_now - interval '1 day';

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_edge_rate_limit(text, text, uuid, inet, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(text, text, uuid, inet, integer, integer) TO service_role;
