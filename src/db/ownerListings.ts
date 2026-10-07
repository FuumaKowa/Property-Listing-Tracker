import { OwnerListing } from '../ownerListing';

export interface OwnerListingDb {
  query: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
}

// Legacy baseline for database bootstrap and isolated fixtures.
// Apply the checked-in migrations before starting the API.
export const ownerListingsTableSql = `CREATE TABLE IF NOT EXISTS owner_listings (
  id SERIAL PRIMARY KEY,
  owner_name TEXT NOT NULL CHECK (length(trim(owner_name)) BETWEEN 1 AND 200),
  no_tel TEXT NOT NULL CHECK (length(trim(no_tel)) BETWEEN 1 AND 50),
  property_name TEXT NOT NULL CHECK (length(trim(property_name)) BETWEEN 1 AND 300),
  property_link TEXT NOT NULL DEFAULT '',
  property_type TEXT NOT NULL CHECK (property_type IN ('landed', 'highrise', 'land', 'commercial')),
  property_price NUMERIC(18,2) NOT NULL CHECK (property_price >= 0),
  status TEXT NOT NULL DEFAULT 'Unlisted' CHECK (status IN ('Listed', 'Unlisted')),
  updated_by_name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
)`;

// Upgrade owner tables created before property links were introduced.
export const ownerListingsLinkSql = "ALTER TABLE owner_listings ADD COLUMN IF NOT EXISTS property_link TEXT NOT NULL DEFAULT ''";

export const ownerColumns = `id, owner_name AS "ownerName", no_tel AS "noTel", property_name AS "propertyName",
  property_link AS "propertyLink", property_type AS "propertyType", property_price::text AS "propertyPrice", status,
  location, version, created_at AT TIME ZONE 'UTC' AS "createdAt", assigned_agent_id AS "assignedAgentId", assigned_agent_name AS "assignedAgentName",
  assigned_at AS "assignedAt", last_agent_activity_at AS "lastAgentActivityAt", seeding_status AS "seedingStatus",
  coalesce(last_agent_activity_at,assigned_at)+interval '3 days' AS "activityDueAt",
  (status='Unlisted' AND assigned_agent_id IS NOT NULL AND coalesce(last_agent_activity_at,assigned_at)+interval '3 days'<=now()) AS "needsAttention"`;
const columns=ownerColumns;

export async function readOwnerListings(db: OwnerListingDb): Promise<OwnerListing[]> {
  return await db.query(`SELECT ${columns} FROM owner_listings ORDER BY id`) as unknown as OwnerListing[];
}
