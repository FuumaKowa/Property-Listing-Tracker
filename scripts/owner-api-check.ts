// npm install --no-save --no-package-lock @electric-sql/pglite @playwright/test
// npx tsx scripts/owner-api-check.ts (local test database only)
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { handleOwnerListings } from '../functions/api/_owner-listings';
import { OwnerListingDb } from '../src/db/ownerListings';

const postgres = new PGlite();
const db: OwnerListingDb = { query: async (sql, params) => (await postgres.query<Record<string, unknown>>(sql, params)).rows };
let authenticated = true;
let connects = 0;
const services = {
  authenticate: async () => authenticated ? { id: 1, username: 'tester', displayName: 'Test User', role: 'user' as const } : null,
  connect: () => { connects++; return db; },
};
async function call(method: string, body?: unknown, id?: string) {
  return handleOwnerListings({ env: { DATABASE_URL: 'test-only' }, params: id ? { id } : undefined,
    request: new Request('http://localhost/api/owner-listings', { method, body: body === undefined ? undefined : JSON.stringify(body) }),
  }, services);
}
const input = { ownerName: "O'Connor", noTel: '+60 0123456789', propertyName: 'Owner Property', propertyType: 'landed', propertyPrice: '1234567890123456.78', status: 'Unlisted' };
try {
  authenticated = false;
  assert.equal((await call('GET')).status, 401);
  assert.equal((await call('POST', input)).status, 401);
  assert.equal(connects, 0, 'Unauthorized requests cannot initialize or access the table');
  authenticated = true;
  assert.equal((await call('PATCH', input, '-1')).status, 400);
  assert.equal((await call('PATCH', input, '1.5')).status, 400);
  for (const changes of [{ ownerName: ' ' }, { noTel: '' }, { propertyName: '' }, { propertyType: 'apartment' }, { status: 'Active' }, { propertyPrice: '-1' }, { propertyPrice: 'NaN' }, { propertyPrice: '1.999' }, { propertyPrice: '10000000000000000' }]) {
    assert.equal((await call('POST', { ...input, ...changes })).status, 400);
  }
  assert.deepEqual((await (await call('GET')).json()).data, []);
  const created = await call('POST', input);
  assert.equal(created.status, 201);
  const row = (await created.json()).data;
  assert.equal(row.propertyPrice, input.propertyPrice, 'Price must retain all decimal digits');
  assert.equal(row.noTel, input.noTel, 'Phone must preserve leading zeros and +');
  const edited = { ...input, propertyType: 'commercial', status: 'Listed', propertyPrice: '250000.00' };
  assert.equal((await call('PATCH', edited, String(row.id))).status, 200);
  const persisted = (await (await call('GET')).json()).data[0];
  assert.equal(persisted.status, 'Listed');
  assert.equal(persisted.propertyType, 'commercial');
  assert.equal(persisted.propertyPrice, '250000.00');
  assert.equal((await call('PATCH', edited, '999999')).status, 404);
  await assert.rejects(() => db.query("INSERT INTO owner_listings (owner_name,no_tel,property_name,property_type,property_price,status,updated_by_name) VALUES ('A','01','P','invalid',1,'Listed','T')"));
  await assert.rejects(() => db.query("UPDATE owner_listings SET status='Expired'"));
  await assert.rejects(() => db.query('UPDATE owner_listings SET property_price=-1'));
  assert.equal((await call('DELETE', undefined, String(row.id))).status, 200);
  assert.equal((await call('DELETE', undefined, String(row.id))).status, 404);
  assert.deepEqual((await (await call('GET')).json()).data, []);
  console.log('PASS owner API authentication, validation, decimal precision, CRUD persistence, constraints, and missing records');
} finally { await postgres.close(); }
