-- Unapplied production migration, corrected to target Master Listing Owner only.
ALTER TABLE public.owner_listings
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS listing_id text,
  ADD COLUMN IF NOT EXISTS transaction_type text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS source_property_type text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS bedrooms integer,
  ADD COLUMN IF NOT EXISTS bathrooms numeric(8,2),
  ADD COLUMN IF NOT EXISTS tenure text,
  ADD COLUMN IF NOT EXISTS advertiser_type text,
  ADD COLUMN IF NOT EXISTS owner_status text,
  ADD COLUMN IF NOT EXISTS owner_score numeric(10,4),
  ADD COLUMN IF NOT EXISTS owner_evidence jsonb,
  ADD COLUMN IF NOT EXISTS listing_date date,
  ADD COLUMN IF NOT EXISTS discovery_channel text,
  ADD COLUMN IF NOT EXISTS found_at timestamptz;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS owner_listings_source_listing_id_unique
  ON public.owner_listings (source, listing_id);
