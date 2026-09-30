ALTER TABLE public.listings
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN archived_by_name text;

ALTER TABLE public.listing_publications ADD COLUMN version integer NOT NULL DEFAULT 1;
