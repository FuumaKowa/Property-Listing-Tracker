-- Expand the allowed owner seeding stages; preserve every existing record.
ALTER TABLE public.owner_listings
  DROP CONSTRAINT owner_listings_seeding_status_check,
  ADD CONSTRAINT owner_listings_seeding_status_check
    CHECK (seeding_status IN ('IFU1','IFU2','IFU3','Contacted'));
