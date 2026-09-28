ALTER TABLE public.listings
  ADD COLUMN property_guru_repost_date date,
  ADD COLUMN property_guru_repost_mode text,
  ADD CONSTRAINT listings_repost_mode_check CHECK (property_guru_repost_mode IN ('Manual', 'Auto'));
--> statement-breakpoint
CREATE TABLE public.publication_channels (
  id serial PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX publication_channels_name_unique ON public.publication_channels (lower(trim(name)));
--> statement-breakpoint
CREATE TABLE public.listing_publications (
  id serial PRIMARY KEY,
  listing_id integer NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  channel_id integer NOT NULL REFERENCES public.publication_channels(id) ON DELETE RESTRICT,
  url text NOT NULL CHECK (length(url) BETWEEN 1 AND 2048),
  label text CHECK (length(label) <= 120),
  notes text CHECK (length(notes) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX listing_publications_listing_idx ON public.listing_publications(listing_id);
--> statement-breakpoint
INSERT INTO public.publication_channels(name) VALUES ('PropertyGuru'), ('Mudah'), ('Telegram'), ('TikTok') ON CONFLICT DO NOTHING;
