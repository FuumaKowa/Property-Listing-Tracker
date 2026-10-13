ALTER TABLE public.listings ADD COLUMN source_owner_listing_id integer;
--> statement-breakpoint
CREATE UNIQUE INDEX listings_source_owner_listing_unique ON public.listings(source_owner_listing_id);
