ALTER TABLE public.listings
  ADD COLUMN created_by_user_id text,
  ADD COLUMN created_by_name text,
  ADD COLUMN is_priority boolean NOT NULL DEFAULT false;
