import { OwnerListing, OwnerListingInput } from '../ownerListing';

export interface OwnerListingDb {
  query: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
}

// Additive and idempotent, following the existing auth table initialization.
// Called only after authentication. Existing property listings are untouched.
export const ownerListingsTableSql = `CREATE TABLE IF NOT EXISTS owner_listings (
  id SERIAL PRIMARY KEY,
  owner_name TEXT NOT NULL CHECK (length(trim(owner_name)) BETWEEN 1 AND 200),
  no_tel TEXT NOT NULL CHECK (length(trim(no_tel)) BETWEEN 1 AND 50),
  property_name TEXT NOT NULL CHECK (length(trim(property_name)) BETWEEN 1 AND 300),
  property_type TEXT NOT NULL CHECK (property_type IN ('landed', 'highrise', 'land', 'commercial')),
  property_price NUMERIC(18,2) NOT NULL CHECK (property_price >= 0),
  status TEXT NOT NULL DEFAULT 'Unlisted' CHECK (status IN ('Listed', 'Unlisted')),
  updated_by_name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
)`;

const columns = `id, owner_name AS "ownerName", no_tel AS "noTel", property_name AS "propertyName",
  property_type AS "propertyType", property_price::text AS "propertyPrice", status`;

export async function readOwnerListings(db: OwnerListingDb): Promise<OwnerListing[]> {
  return await db.query(`SELECT ${columns} FROM owner_listings ORDER BY id`) as unknown as OwnerListing[];
}

export async function writeOwnerListing(db: OwnerListingDb, input: OwnerListingInput, userName: string, id?: number): Promise<OwnerListing | undefined> {
  const params = [input.ownerName, input.noTel, input.propertyName, input.propertyType, input.propertyPrice, input.status, userName];
  const rows = id === undefined
    ? await db.query(`INSERT INTO owner_listings (owner_name, no_tel, property_name, property_type, property_price, status, updated_by_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${columns}`, params)
    : await db.query(`UPDATE owner_listings SET owner_name=$1, no_tel=$2, property_name=$3, property_type=$4,
        property_price=$5, status=$6, updated_by_name=$7, updated_at=NOW() WHERE id=$8 RETURNING ${columns}`, [...params, id]);
  return rows[0] as unknown as OwnerListing | undefined;
}

export async function removeOwnerListing(db: OwnerListingDb, id: number): Promise<boolean> {
  return (await db.query('DELETE FROM owner_listings WHERE id=$1 RETURNING id', [id])).length > 0;
}
