-- Add Invalid link as an owner seeding stage without changing stored URLs or records.
ALTER TABLE public.owner_listings
  DROP CONSTRAINT owner_listings_seeding_status_check,
  ADD CONSTRAINT owner_listings_seeding_status_check
    CHECK (seeding_status IN ('IFU1','IFU2','IFU3','Contacted','Invalid link'));

