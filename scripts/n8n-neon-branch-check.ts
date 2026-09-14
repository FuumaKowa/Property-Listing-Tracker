import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import express from 'express';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import * as schema from '../src/db/schema';
import { createN8nRouter } from '../src/server/n8n/express';
import { handleN8nPages } from '../src/server/n8n/pages';

// No dotenv fallback: this script must receive the explicitly verified disposable branch.
const connectionString = process.env.N8N_TEST_DATABASE_URL;
const expectedHost = process.env.N8N_TEST_EXPECTED_HOST;
assert(connectionString && expectedHost, 'Explicit isolated branch URL and verified host required');
assert.equal(new URL(connectionString).hostname, expectedHost);
const pool = new Pool({ connectionString, connectionTimeoutMillis: 15000 });
const db = drizzle(pool, { schema });
const http = drizzleHttp(neon(connectionString), { schema });
const fingerprint = async () => (await pool.query(`SELECT count(*)::text AS count, md5(coalesce(string_agg(to_jsonb(t)::text, '' ORDER BY id),'')) AS hash FROM public.listings t`)).rows;
const normalColumns = async () => (await pool.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='listings' ORDER BY ordinal_position")).rows;
const before = await fingerprint();
const columnsBefore = await normalColumns();
const ownerBefore = (await pool.query('SELECT count(*)::int AS n FROM public.owner_listings')).rows[0].n;
const app = express();
const key = randomUUID();
app.use('/api/integrations/n8n/owner-listings', createN8nRouter(() => key, statement => db.execute(statement)));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert(address && typeof address !== 'string');
const url = `http://127.0.0.1:${address.port}/api/integrations/n8n/owner-listings`;
const listing_id = 'isolated-' + randomUUID();
const payload = { source: 'OwnerHunter-Test', listing_id, title: 'Isolated branch API test', price: 'RM 300,000', property_type: 'Apartment', url: 'https://example.com/listing/' + listing_id, bedrooms: '3', bathrooms: '2', owner_score: '100', size: '1,041 sq.ft', listing_date: '', found_at: '', owner_evidence: { signals: ['Test fixture only'] } };
try {
  await migrate(db, { migrationsFolder: './drizzle' });
  const cols = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='owner_listings'")).rows;
  assert.equal(cols.length, 27);
  const idx = (await pool.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='owner_listings_source_listing_id_unique'")).rows;
  assert.equal(idx.length, 1);
  assert.match(idx[0].indexdef, /UNIQUE.*owner_listings.*\(source, listing_id\)/);
  for (const runtime of ['express','pages']) {
    const req = (authorized = true) => new Request(url, { method: 'POST', headers: { 'Content-Type':'application/json', ...(authorized ? {'X-API-Key':key} : {}) }, body: JSON.stringify(payload) });
    const call = (authorized = true) => runtime === 'express' ? fetch(req(authorized)) : handleN8nPages(req(authorized), key, statement => http.execute(statement));
    assert.equal((await call(false)).status, 401);
    const response = await call();
    assert.equal(response.status, runtime === 'express' ? 201 : 200);
    const result = await response.json();
    assert.equal(result.record.property_type, 'highrise');
    assert.equal(result.record.property_price, '300000.00');
    assert.equal(result.record.owner_name, 'Not captured');
    assert.equal(result.record.no_tel, 'Not captured');
    assert.equal(result.record.status, 'Unlisted');
    assert.equal((await call()).status, 200);
  }
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.owner_listings')).rows[0].n, ownerBefore + 1);
  await assert.rejects(() => pool.query(`INSERT INTO public.owner_listings (owner_name,no_tel,property_name,property_type,property_price,updated_by_name,source,listing_id) VALUES ('Not captured','Not captured','Test','landed',1,'Test','ownerhunter-test',$1)`, [listing_id]), (error: any) => error.code === '23505');
  assert.deepEqual(await fingerprint(), before);
  assert.deepEqual(await normalColumns(), columnsBefore);
  console.log('PASS fresh Neon branch: migration, 27 owner columns, unique index, Node and Neon HTTP adapters, 401/201/200, single owner row, unchanged normal listings data/schema');
} finally {
  // Remove only this script's unique fixture from the verified test branch.
  await pool.query("DELETE FROM public.owner_listings WHERE source='ownerhunter-test' AND listing_id=$1", [listing_id]).catch(() => {});
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end();
}
