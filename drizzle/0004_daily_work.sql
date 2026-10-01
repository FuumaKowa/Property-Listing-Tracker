-- Shared, reversible warning preferences only; existing property values are untouched.
ALTER TABLE public.listings ADD COLUMN ignored_data_warnings jsonb NOT NULL DEFAULT '[]'::jsonb;
