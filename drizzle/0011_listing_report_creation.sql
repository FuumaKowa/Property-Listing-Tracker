ALTER TABLE owner_listings ALTER COLUMN property_price DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE owner_listings DROP CONSTRAINT owner_listings_property_type_check;
--> statement-breakpoint
ALTER TABLE owner_listings ADD CONSTRAINT owner_listings_property_type_check CHECK (property_type IN ('landed','highrise','land','commercial','pending'));
--> statement-breakpoint
CREATE TABLE listing_report_references (
 reference text PRIMARY KEY CHECK (length(reference) BETWEEN 1 AND 80),
 listing_id integer NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
