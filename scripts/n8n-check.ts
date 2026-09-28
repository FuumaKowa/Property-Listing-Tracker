import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { ownerListingsTableSql } from '../src/db/ownerListings';
import { PgDialect } from 'drizzle-orm/pg-core';
import { once } from 'node:events';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../src/db/schema';
import { createN8nRouter } from '../src/server/n8n/express';
import { handleN8nPages } from '../src/server/n8n/pages';
import type { ExecuteIngestQuery } from '../src/server/n8n/repository';

// Disposable in-memory database. This script never loads dotenv or the live DB module.
const postgres = new PGlite();
await postgres.exec(`
  CREATE TABLE listings (
    id SERIAL PRIMARY KEY, property TEXT NOT NULL, project_category TEXT NOT NULL DEFAULT 'Project Marketing (PM)',
    location TEXT NOT NULL, tenure TEXT NOT NULL DEFAULT '-', pm TEXT NOT NULL DEFAULT '-', negotiator TEXT, agent TEXT, no_tel TEXT,
    available_units TEXT NOT NULL DEFAULT '-', status TEXT NOT NULL DEFAULT 'Active', date TEXT NOT NULL DEFAULT '',
    renew_status TEXT NOT NULL DEFAULT 'Not Renewed', notes TEXT, updated_by_user_id TEXT, updated_by_name TEXT DEFAULT 'System',
    updated_by_email TEXT, last_updated_at TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE listing_audit_logs (
    id SERIAL PRIMARY KEY, listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    action TEXT NOT NULL, changed_fields TEXT, user_name TEXT NOT NULL DEFAULT 'System', user_email TEXT, user_uid TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE auth_users (id SERIAL PRIMARY KEY, username TEXT NOT NULL);
  INSERT INTO auth_users (username) VALUES ('unchanged-user');
  INSERT INTO listings (property,location) VALUES ('Manual listing','Kuala Lumpur');
`);
await postgres.exec(ownerListingsTableSql);
const normalBefore = (await postgres.query('SELECT * FROM listings ORDER BY id')).rows;
const normalSchemaBefore = (await postgres.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_name='listings' ORDER BY ordinal_position")).rows;
const db = drizzle(postgres, { schema });
// This test verifies OwnerHunter's migration in isolation, not later normal-listing features.
const migrationFixture = mkdtempSync(nodePath.join(tmpdir(), 'owner-migration-'));
try {
  mkdirSync(nodePath.join(migrationFixture, 'meta'));
  const journal = JSON.parse(readFileSync('./drizzle/meta/_journal.json','utf8'));
  writeFileSync(nodePath.join(migrationFixture,'meta/_journal.json'),JSON.stringify({...journal,entries:journal.entries.filter((entry:{idx:number})=>entry.idx===0)}));
  writeFileSync(nodePath.join(migrationFixture,'0000_n8n_ingestion.sql'),readFileSync('./drizzle/0000_n8n_ingestion.sql'));
  await migrate(db, { migrationsFolder: migrationFixture });
  await migrate(db, { migrationsFolder: migrationFixture });
} finally { rmSync(migrationFixture,{recursive:true,force:true}); }
assert.equal((await db.select({property:schema.listings.property}).from(schema.listings))[0].property, 'Manual listing');
assert.equal((await postgres.query<{ username: string }>('SELECT username FROM auth_users')).rows[0].username, 'unchanged-user');

const secret = 'local-n8n-test-secret-not-a-production-key';
let configured: string | undefined = secret;
let simulateFailure = false;
let queries = 0;
const execute: ExecuteIngestQuery = async statement => {
  const query = new PgDialect().sqlToQuery(statement).sql;
  assert(!/\b(?:public\.)?listings\b|listing_audit_logs|project_category/i.test(query), 'Ingestion SQL must never touch normal listings');
  queries++;
  if (simulateFailure) throw new Error('postgresql://private-password@private-host/test N8N_SECRET_VALUE');
  return db.execute(statement);
};
const app = express();
app.use('/api/integrations/n8n/owner-listings', createN8nRouter(() => configured, execute));
app.use(express.json());
app.get('/api/auth/me', (_req, res) => { res.json({ authenticated: false }); });
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;
const path = '/api/integrations/n8n/owner-listings';
type Options = { method?: string; key?: string | null; raw?: string; contentType?: string; query?: string };
const payload = { source: 'Mudah', listing_id: '115715270', url: 'https://www.mudah.my/example-115715270.htm',
  title: 'Direct owner terrace', transaction_type: 'sale', property_type: 'landed', location: 'Shah Alam',
  price: '650000.50', size: '1800 sqft', bedrooms: 4, bathrooms: '2.5', tenure: 'Freehold',
  advertiser_type: 'owner', owner_status: 'likely_owner', owner_score: 85,
  owner_evidence: ['Direct owner mentioned', { signal: 'No agent' }], listing_date: '2026-09-11',
  discovery_channel: 'n8n', found_at: '2026-09-11T16:00:00+08:00',
};

async function request(runtime: 'express' | 'pages', value: unknown, options: Options = {}) {
  const method = options.method ?? 'POST';
  const key = options.key === undefined ? secret : options.key;
  const headers: Record<string, string> = { 'Content-Type': options.contentType ?? 'application/json' };
  if (key !== null) headers['X-API-Key'] = key;
  const body = ['GET', 'HEAD'].includes(method) ? undefined : options.raw ?? JSON.stringify(value);
  const url = `${origin}${path}${options.query ?? ''}`;
  return runtime === 'express' ? fetch(url, { method, headers, body }) : handleN8nPages(new Request(url, { method, headers, body }), configured, execute);
}

try {
  for (const runtime of ['express', 'pages'] as const) {
    const start = queries;
    for (const key of [null, 'wrong', '', 'x'.repeat(513)]) {
      assert.equal((await request(runtime, payload, { key, raw: '{bad' })).status, 401, 'Authentication must precede parsing');
    }
    assert.equal((await request(runtime, payload, { key: null, query: `?api_key=${secret}` })).status, 401);
    configured = undefined;
    assert.equal((await request(runtime, payload)).status, 401, 'No configured key must fail closed');
    configured = secret;
    assert.equal(queries, start, 'Unauthorized requests cannot query the database');

    for (const invalid of [null, [], {}, { ...payload, title: '' }, { ...payload, price: null }, { ...payload, property_type: 'Mystery building' }, { ...payload, property_type: '' }, { ...payload, source: 'bad/source' }, { ...payload, listing_id: 'bad id' }, { ...payload, owner_evidence: '界'.repeat(6000) }, { ...payload, source: '' }, { ...payload, listing_id: '' }, { ...payload, url: 'javascript:alert(1)' },
      { ...payload, url: '/relative' }, { ...payload, url: 'https://user:password@example.com' }, { ...payload, price: '-1' },
      { ...payload, price: '1.234' }, { ...payload, price: {} }, { ...payload, bedrooms: 2.5 }, { ...payload, bedrooms: true },
      { ...payload, owner_score: 'NaN' }, { ...payload, listing_id: Number.MAX_SAFE_INTEGER + 1 },
      { ...payload, listing_date: '2026-02-30' }, { ...payload, found_at: '2026-09-11' },
      { ...payload, found_at: '2026-02-30T00:00:00Z' }, { ...payload, unexpected: true }]) {
      const response = await request(runtime, invalid);
      assert.equal(response.status, 400, JSON.stringify(invalid));
      assert.equal((await response.json()).success, false);
    }
    assert.equal((await request(runtime, payload, { raw: '{invalid' })).status, 400);
    assert.equal((await request(runtime, payload, { raw: ' '.repeat(66000) })).status, 400);
    assert.equal((await request(runtime, payload, { contentType: 'text/plain' })).status, 400);
    const methodResponse = await request(runtime, payload, { method: 'GET' });
    assert.equal(methodResponse.status, 405);
    assert.equal(methodResponse.headers.get('Allow'), 'POST');
    assert.equal(queries, start, 'Invalid requests cannot query the database');

    const input = { ...payload, listing_id: `${runtime}-115715270` };
    const created = await request(runtime, input);
    assert.equal(created.status, 201);
    assert.equal(created.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(created.headers.get('Cache-Control'), 'no-store');
    const result = await created.json();
    assert.equal(result.status, 'created');
    assert.equal(result.record.source, 'mudah');
    assert.equal(result.record.property_price, '650000.50');
    assert.equal(result.record.bathrooms, '2.50');
    assert.equal(result.record.found_at, '2026-09-11T08:00:00.000Z');
    assert.deepEqual(result.record.owner_evidence, payload.owner_evidence);
    assert.equal(result.record.property_link, payload.url);
    const beforeDuplicate = (await postgres.query('SELECT count(*) FROM owner_listings')).rows;
    const duplicate = await request(runtime, { ...input, source: '  MUDAH ', title: 'Must not overwrite', price: 1 });
    assert.equal(duplicate.status, 200);
    assert.deepEqual((await postgres.query('SELECT count(*) FROM owner_listings')).rows, beforeDuplicate);
    const existing = await duplicate.json();
    assert.equal(existing.status, 'already_exists');
    assert.deepEqual(existing.record, result.record, 'A duplicate must return the stored record without overwriting it');

    const minimal = await request(runtime, { source: runtime, listing_id: 123, url: 'https://example.com/123', title: 'Required title', price: 0, property_type: 'Apartment' });
    assert.equal(minimal.status, 201);
    const minimalRecord = (await minimal.json()).record;
    assert.equal(minimalRecord.listing_id, '123');
    assert.equal(minimalRecord.owner_evidence, null);
    assert.equal(minimalRecord.property_price, '0.00');
    assert.equal(minimalRecord.owner_name, 'Not captured');
    assert.equal(minimalRecord.no_tel, 'Not captured');
    assert.equal(minimalRecord.status, 'Unlisted');
    assert.equal(minimalRecord.updated_by_name, 'n8n Owner Hunter');
    for (const [property_type, expected] of [['Apartment','highrise'],['Terraced House','landed'],['Residential Land','land'],['Warehouse','commercial']]) {
      const mapped = await request(runtime, { ...payload, listing_id: runtime + '-' + expected, property_type, owner_name: 'Provided owner', phone: '+60123456789' });
      assert.equal(mapped.status, 201);
      const row = (await mapped.json()).record;
      assert.equal(row.property_type, expected);
      assert.equal(row.source_property_type, property_type);
      assert.equal(row.owner_name, 'Provided owner');
      assert.equal(row.no_tel, '+60123456789');
    }
    assert.equal(minimalRecord.listing_date, null);

    const scraperInput = { ...payload, listing_id: `${runtime}-scraper`, price: 'RM 300,000', size: '1,041 sq.ft', bedrooms: '3', bathrooms: '2', owner_score: '100', listing_date: '', found_at: '', owner_evidence: 'Private advertiser' };
    const scraperResponse = await request(runtime, scraperInput);
    assert.equal(scraperResponse.status, 201);
    const scraperRecord = (await scraperResponse.json()).record;
    assert.equal(scraperRecord.property_price, '300000.00');
    assert.equal(scraperRecord.size, '1,041 sq.ft');
    assert.equal(scraperRecord.bedrooms, 3);
    assert.equal(scraperRecord.bathrooms, '2.00');
    assert.equal(scraperRecord.owner_score, '100.0000');
    assert.equal(scraperRecord.listing_date, null);
    assert.equal(scraperRecord.found_at, null);
    assert.equal(scraperRecord.owner_evidence, 'Private advertiser');
    assert.equal((await request(runtime, scraperInput)).status, 200);
    for (const price of ['RM 30,00', 'USD 300', 'RM -1']) assert.equal((await request(runtime, { ...scraperInput, price })).status, 400);

    simulateFailure = true;
    const failed = await request(runtime, { ...payload, listing_id: 'failure' });
    assert.equal(failed.status, 500);
    const failureText = await failed.text();
    assert(!/private|postgresql|SECRET|password|stack/i.test(failureText));
    simulateFailure = false;
    console.log(`PASS ${runtime}: auth before parsing, validation, 201/200, preservation, JSON metadata, safe errors`);
  }

  const concurrent = await Promise.all(Array.from({ length: 12 }, (_, index) => request(index % 2 ? 'pages' : 'express', { ...payload, listing_id: 'concurrent' })));
  assert.equal(concurrent.filter(response => response.status === 201).length, 1);
  assert.equal(concurrent.filter(response => response.status === 200).length, 11);
  const records = await Promise.all(concurrent.map(response => response.json()));
  assert.equal(new Set(records.map(result => result.record.id)).size, 1);
  assert.equal((await postgres.query("SELECT count(*) FROM owner_listings WHERE source='mudah' AND listing_id='concurrent'")).rows[0].count, 1);
  await assert.rejects(() => postgres.query("INSERT INTO owner_listings (owner_name,no_tel,property_name,property_type,property_price,updated_by_name,source,listing_id) VALUES ('Not captured','Not captured','Duplicate','landed',1,'Test','mudah','concurrent')"), /duplicate|unique/i);
  assert.deepEqual((await postgres.query('SELECT * FROM listings ORDER BY id')).rows, normalBefore);
  assert.deepEqual((await postgres.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_name='listings' ORDER BY ordinal_position")).rows, normalSchemaBefore);
  assert.equal((await postgres.query('SELECT * FROM listing_audit_logs')).rows.length, 0);
  assert.equal((await fetch(origin + '/api/auth/me')).status, 200);
  console.log('PASS owner-only migration and ingestion, unchanged normal rows/schema/audit, 12 concurrent requests and database uniqueness');
} finally {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await postgres.close();
}
