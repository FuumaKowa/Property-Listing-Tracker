CREATE TABLE IF NOT EXISTS iclick_listing_images (
  id serial PRIMARY KEY,
  listing_id integer NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  file_key text NOT NULL UNIQUE,
  object_key text NOT NULL UNIQUE,
  title text NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT iclick_listing_images_file_key_check CHECK (file_key ~ '^[a-f0-9-]{36}\.(jpg|png|webp)$'),
  CONSTRAINT iclick_listing_images_content_type_check CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  CONSTRAINT iclick_listing_images_byte_size_check CHECK (byte_size BETWEEN 1 AND 15728640),
  CONSTRAINT iclick_listing_images_title_check CHECK (length(trim(title)) BETWEEN 1 AND 160)
);
CREATE INDEX IF NOT EXISTS iclick_listing_images_listing_idx ON iclick_listing_images(listing_id);
