import { getTableColumns, sql, type SQL } from 'drizzle-orm';
import { ownerListings } from '../../db/schema';
import type { N8nListing } from './validation';

export type ExecuteIngestQuery = (statement: SQL) => Promise<{ rows: Record<string, unknown>[] } | Record<string, unknown>[]>;
const rowsOf = (result: Awaited<ReturnType<ExecuteIngestQuery>>) => Array.isArray(result) ? result : result.rows;
const projection = sql`id, owner_name, no_tel, property_name, property_type, property_price::text AS property_price,
  property_link, status, updated_by_name, source, listing_id, transaction_type, location, source_property_type,
  size, bedrooms, bathrooms::text AS bathrooms, tenure, advertiser_type, owner_status,
  owner_score::text AS owner_score, owner_evidence, listing_date::text AS listing_date, discovery_channel, found_at`;
const table = sql`public.owner_listings`;
function record(row: Record<string, unknown>) {
  return { ...row, found_at: row.found_at ? new Date(row.found_at as string | Date).toISOString() : null };
}

// This service has no dependency on the normal listings or audit models.
export async function ingestListing(execute: ExecuteIngestQuery, input: N8nListing) {
  const values: typeof ownerListings.$inferInsert = {
    ownerName: input.owner_name, noTel: input.phone, propertyName: input.title,
    propertyType: input.property_type, propertyPrice: input.price, propertyLink: input.url,
    status: 'Unlisted', updatedByName: 'n8n Owner Hunter',
    source: input.source, externalListingId: input.listing_id, transactionType: input.transaction_type,
    location: input.location, sourcePropertyType: input.source_property_type, size: input.size,
    bedrooms: input.bedrooms, bathrooms: input.bathrooms, tenure: input.tenure,
    advertiserType: input.advertiser_type, ownerStatus: input.owner_status, ownerScore: input.owner_score,
    ownerEvidence: input.owner_evidence, listingDate: input.listing_date,
    discoveryChannel: input.discovery_channel, foundAt: input.found_at,
  };
  const columns = getTableColumns(ownerListings);
  const entries = Object.entries(values) as [keyof typeof values, unknown][];
  const columnList = sql.join(entries.map(([key]) => sql.identifier(columns[key].name)), sql`, `);
  const parameters = sql.join(entries.map(([key, value]) => sql.param(value, columns[key])), sql`, `);
  const inserted = rowsOf(await execute(sql`INSERT INTO ${table} (${columnList}) VALUES (${parameters})
    ON CONFLICT (source, listing_id) DO NOTHING RETURNING ${projection}`));
  if (inserted[0]) return { success: true as const, status: 'created' as const, record: record(inserted[0]) };
  // A fresh statement sees the committed winner of a concurrent unique-key conflict.
  const existing = rowsOf(await execute(sql`SELECT ${projection} FROM ${table}
    WHERE source=${input.source} AND listing_id=${input.listing_id} LIMIT 1`));
  if (!existing[0]) throw new Error('Owner listing was removed during ingestion; retry the request.');
  return { success: true as const, status: 'already_exists' as const, record: record(existing[0]) };
}
