ALTER TABLE listings ADD COLUMN asking_price numeric(18,2);
ALTER TABLE listings ADD CONSTRAINT listings_asking_price_check CHECK (asking_price IS NULL OR asking_price >= 0);
