import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { ownerListingsTableSql } from '../src/db/ownerListings';

assert.ok(existsSync('src/publications.ts'), 'Shared publication validation must exist');
const { validateChannelName, validatePublicationInput, validateRepostFields } = await import('../src/publications');
assert.equal(validateChannelName(' Telegram '), 'Telegram');
for (const name of ['', ' ', 'x'.repeat(81), 12]) assert.throws(() => validateChannelName(name));
assert.equal(validatePublicationInput({ channelId: 1, url: 'https://example.com/ad' }).url, 'https://example.com/ad');
for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://u:p@example.com', '/relative', 'https://', 'https://example.com/' + 'x'.repeat(2048)]) assert.throws(() => validatePublicationInput({ channelId: 1, url }));
for (const channelId of [0, -1, 1.5, '1']) assert.throws(() => validatePublicationInput({ channelId, url: 'https://example.com' }));
assert.deepEqual(validateRepostFields({}), {});
assert.deepEqual(validateRepostFields({ propertyGuruRepostDate: null }), { propertyGuruRepostDate: null });
assert.throws(() => validateRepostFields({ propertyGuruRepostDate: '2026-02-30' }));
const pg = new PGlite();
try {
  // Representative pre-release schema, including a legacy column unknown to the UI.
  // No production connection or credentials are used by this test.
  await pg.exec(`
    CREATE TABLE listings (
      id serial PRIMARY KEY, property text NOT NULL, project_category text NOT NULL,
      location text NOT NULL, tenure text, pm text, negotiator text, agent text, no_tel text,
      available_units text, status text, date text, renew_status text, notes text,
      updated_by_user_id text, updated_by_name text, updated_by_email text,
      last_updated_at timestamp, created_at timestamp, legacy_extra jsonb
    );
    INSERT INTO listings SELECT n, 'Existing ' || n, category, 'Kuala Lumpur', 'Freehold',
      'PIC A / PIC B', 'Lister', 'Separate legacy agent', '+60 sample', '3',
      CASE WHEN n=2 THEN 'Sold Out' WHEN n=3 THEN 'Pending' ELSE 'Active' END,
      '2026-01-01', 'Want to be renew', E'Notes with a newline\\nand Unicode 马来西亚',
      'existing-user', 'Existing editor', 'sample@example.com',
      '2026-01-02'::timestamp, '2025-01-01'::timestamp, '{"preserve": [1, "original"]}'::jsonb
    FROM unnest(ARRAY['Project Marketing (PM)','Rental','Subsale CoA (SSCOA)',
      'Subsale Direct Listing (SSDL)','Million Dollar Property (MD)','Auction'])
      WITH ORDINALITY AS categories(category,n);
    CREATE TABLE listing_audit_logs(id serial PRIMARY KEY, listing_id integer REFERENCES listings(id), changed_fields jsonb);
    INSERT INTO listing_audit_logs(listing_id,changed_fields) VALUES (1,'{"notes":"original audit"}');
    CREATE TABLE auth_users(id serial PRIMARY KEY, username text, password_hash text);
    INSERT INTO auth_users(username,password_hash) VALUES ('sample-user','synthetic-hash');
    CREATE TABLE auth_sessions(id serial PRIMARY KEY,user_id integer REFERENCES auth_users(id),session_token_hash text);
    INSERT INTO auth_sessions(user_id,session_token_hash) VALUES (1,'synthetic-session');
    CREATE TABLE users(id serial PRIMARY KEY,uid text,email text);
    INSERT INTO users(uid,email) VALUES ('legacy-user','sample@example.com');
  `);
  await pg.exec(ownerListingsTableSql);
  await pg.exec(readFileSync('drizzle/0000_n8n_ingestion.sql', 'utf8'));
  await pg.exec(`INSERT INTO owner_listings(owner_name,no_tel,property_name,property_type,property_price,
    updated_by_name,property_link,source,listing_id,owner_evidence)
    VALUES ('Not captured','Not captured','Owner','highrise',300000.50,'Original editor',
      'https://example.com/original','Sample','original-id','{"original":true}');`);
  const tables = ['listings','owner_listings','listing_audit_logs','auth_users','auth_sessions','users'];
  const before = new Map<string, unknown>();
  for (const table of tables) {
    before.set(table, (await pg.query(`SELECT to_jsonb(t) AS record FROM ${table} t ORDER BY id`)).rows);
  }
  const columnsBefore = (await pg.query(`SELECT table_name,column_name,data_type,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`)).rows;
  await pg.exec(readFileSync('drizzle/0001_publication_channels.sql', 'utf8'));
  for (const table of tables) {
    const record = table === 'listings'
      ? "to_jsonb(t) - 'property_guru_repost_date' - 'property_guru_repost_mode'"
      : 'to_jsonb(t)';
    assert.deepEqual((await pg.query(`SELECT ${record} AS record FROM ${table} t ORDER BY id`)).rows,
      before.get(table), `Every existing value and row in ${table} must survive unchanged`);
  }
  const columnsAfter = (await pg.query(`SELECT table_name,column_name,data_type,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public'
    AND table_name NOT IN ('publication_channels','listing_publications')
    AND NOT (table_name='listings' AND column_name IN ('property_guru_repost_date','property_guru_repost_mode'))
    ORDER BY table_name,ordinal_position`)).rows;
  assert.deepEqual(columnsAfter,columnsBefore,'All original columns, defaults and nullability must remain');
  assert.equal((await pg.query<any>('SELECT count(*)::int AS n FROM listings WHERE property_guru_repost_date IS NOT NULL OR property_guru_repost_mode IS NOT NULL')).rows[0].n,0);
  await assert.rejects(pg.query("INSERT INTO publication_channels(name) VALUES (' mudah ')"));
  await pg.exec("INSERT INTO listing_publications(listing_id,channel_id,url) VALUES (1,1,'https://example.com/a'), (1,1,'https://example.com/b')");
  assert.equal((await pg.query<any>('SELECT count(*)::int AS n FROM listing_publications')).rows[0].n, 2);
  await assert.rejects(pg.exec('DELETE FROM publication_channels WHERE id=1'));
  console.log('PASS full-row migration preservation across all listing categories, owners, audit, users and sessions; original columns unchanged; publication validation and multiple links');
} finally { await pg.close(); }
