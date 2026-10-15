-- Pause automatic assignment for all new owner records, including imports.
-- Existing assignments and explicit Admin assignment actions are preserved.
ALTER TABLE public.owner_listings DISABLE TRIGGER owner_assign_on_insert;
