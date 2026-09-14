import { createPool } from '../src/db/index';

// Catalog-only inspection. Never apply migrations or print connection credentials.
const pool = createPool();
const client = await pool.connect();
try {
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout = '15s'");
  const names = ['source', 'listing_id', 'transaction_type', 'source_property_type', 'location', 'tenure', 'size', 'bedrooms', 'bathrooms', 'advertiser_type', 'owner_status', 'owner_score', 'owner_evidence', 'listing_date', 'discovery_channel', 'found_at'];
  const columns = await client.query(`SELECT column_name, data_type, udt_name, is_nullable, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema='public' AND table_name='owner_listings' AND column_name=ANY($1::text[]) ORDER BY column_name`, [names]);
  console.log(JSON.stringify({ columns: columns.rows }));
  const indexes = await client.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='owner_listings' AND indexname='owner_listings_source_listing_id_unique'");
  console.log(JSON.stringify({ indexes: indexes.rows }));
  if (['source', 'listing_id'].every(name => columns.rows.some(row => row.column_name === name))) {
    const duplicates = await client.query('SELECT count(*) AS duplicate_groups FROM (SELECT source,listing_id FROM public.owner_listings WHERE source IS NOT NULL AND listing_id IS NOT NULL GROUP BY source,listing_id HAVING count(*)>1) AS duplicates');
    console.log(JSON.stringify(duplicates.rows[0]));
  } else console.log('Duplicate check not applicable: identity columns do not both exist.');
  await client.query('ROLLBACK');
} catch {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Read-only schema inspection failed; no database changes made.');
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
