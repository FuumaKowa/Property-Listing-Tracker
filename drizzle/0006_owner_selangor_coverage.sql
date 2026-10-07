-- Data-only coverage update. Keep agent login mappings and every listing unchanged.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.owner_assignment_rules
      WHERE key IN ('shahril','hakim','luqman','ikhwan','muz')) <> 5 THEN
    RAISE EXCEPTION 'Expected all five owner assignment rules before updating coverage';
  END IF;
END $$;
--> statement-breakpoint
WITH proposed(key, areas) AS (VALUES
  ('shahril', '["shah alam","setia alam","alam impian"]'::jsonb),
  ('hakim', '["klang","port klang","kapar"]'::jsonb),
  ('luqman', '["petaling jaya","pj","damansara","kota damansara","sunway","ampang"]'::jsonb),
  ('ikhwan', '["puchong","bandar saujana putra","bsp","bandar saujana putera","cyberjaya","subang jaya","seri kembangan","bangi","kajang","semenyih","sepang"]'::jsonb),
  ('muz', '["rawang","puncak alam","sungai buloh","selayang","bukit beruntung"]'::jsonb)
), old AS MATERIALIZED (
  SELECT r.* FROM public.owner_assignment_rules r JOIN proposed p ON p.key=r.key FOR UPDATE OF r
), changed AS (
  UPDATE public.owner_assignment_rules r SET areas=p.areas
  FROM proposed p, old o WHERE r.key=p.key AND r.key=o.key AND r.areas IS DISTINCT FROM p.areas
  RETURNING r.*
)
INSERT INTO public.owner_listing_events(action,actor_name,note,before_record,after_record)
SELECT 'assignment_rule','Assignment coverage migration','Five-agent Selangor coverage update',to_jsonb(o),to_jsonb(c)
FROM changed c JOIN old o ON o.key=c.key;
