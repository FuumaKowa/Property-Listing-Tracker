import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

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
  await pg.exec("CREATE TABLE listings (id serial PRIMARY KEY, property text); INSERT INTO listings(property) VALUES ('Existing'); CREATE TABLE owner_listings (id serial PRIMARY KEY, property_name text); INSERT INTO owner_listings(property_name) VALUES ('Owner');");
  const before = (await pg.query('SELECT * FROM owner_listings')).rows;
  await pg.exec(readFileSync('drizzle/0001_publication_channels.sql', 'utf8'));
  assert.deepEqual((await pg.query('SELECT * FROM owner_listings')).rows, before);
  assert.equal((await pg.query<any>('SELECT property FROM listings')).rows[0].property, 'Existing');
  await assert.rejects(pg.query("INSERT INTO publication_channels(name) VALUES (' mudah ')"));
  await pg.exec("INSERT INTO listing_publications(listing_id,channel_id,url) VALUES (1,1,'https://example.com/a'), (1,1,'https://example.com/b')");
  assert.equal((await pg.query<any>('SELECT count(*)::int AS n FROM listing_publications')).rows[0].n, 2);
  await assert.rejects(pg.exec('DELETE FROM publication_channels WHERE id=1'));
  console.log('PASS publication validation, additive migration, owner isolation, and multiple links');
} finally { await pg.close(); }
