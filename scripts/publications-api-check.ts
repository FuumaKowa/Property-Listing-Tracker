import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import { once } from 'node:events';
import { createPublicationsRouter } from '../src/server/publications/express';
assert.ok(existsSync('functions/api/_publications.ts'), 'Publication handler must exist');
const { handlePublications } = await import('../functions/api/_publications');
const pg = new PGlite();
let authenticated = true;
let connections = 0;
const services = { authenticate: async () => authenticated ? { id: 1, username: 'tester', displayName: 'Tester', role: 'user' as const } : null,
  connect: () => { connections++; return { query: async (sql: string, params?: unknown[]) => (await pg.query<Record<string, unknown>>(sql, params)).rows }; } };
async function call(resource: 'channels' | 'publications' | 'summaries', method = 'GET', body?: unknown, id?: string, listingId = '1') {
  return handlePublications({ request: new Request('http://localhost/api?listingIds=1', { method, body: body === undefined ? undefined : JSON.stringify(body) }), env: { DATABASE_URL: 'test' }, resource, id, listingId }, services);
}
try {
  await pg.exec("CREATE TABLE listings(id serial PRIMARY KEY, property text); INSERT INTO listings(property) VALUES ('Unchanged'),('Other'); CREATE TABLE owner_listings(id serial PRIMARY KEY, property_name text); INSERT INTO owner_listings(property_name) VALUES ('Unchanged owner')");
  await pg.exec(readFileSync('drizzle/0001_publication_channels.sql','utf8'));
  await pg.exec("CREATE TABLE listing_audit_logs(id serial PRIMARY KEY,listing_id integer NOT NULL REFERENCES listings(id),action text,changed_fields text,user_uid text,user_name text,timestamp timestamp DEFAULT now())");
  await pg.exec(readFileSync('drizzle/0003_listing_safety.sql','utf8'));
  const before = (await pg.query('SELECT * FROM listings ORDER BY id')).rows;
  authenticated = false;
  assert.equal((await call('channels')).status, 401); assert.equal(connections, 0);
  authenticated = true;
  assert.equal((await call('channels','POST',{name:' MUDAH '})).status,409);
  const channel = (await (await call('channels','POST',{name:'My channel'})).json()).data;
  const input = { channelId:channel.id,url:'https://example.com/ad',label:'Test',notes:'Notes' };
  const created = await call('publications','POST',input); assert.equal(created.status,201);
  const ad = (await created.json()).data;
  assert.equal((await call('publications','POST',input)).status,201);
  assert.equal((await call('publications','PATCH',{...input,version:1},String(ad.id),'2')).status,404);
  assert.equal((await call('publications','POST',{...input,url:'javascript:alert(1)'})).status,400);
  assert.equal((await call('channels','PATCH',{archived:true},String(channel.id))).status,200);
  assert.equal((await call('publications','POST',input)).status,400);
  assert.equal((await call('publications','PATCH',{...input,label:'Updated',version:1},String(ad.id))).status,200);
  assert.equal((await call('publications','PATCH',{...input,label:'Stale',version:1},String(ad.id))).status,409);
  assert.equal((await call('publications','DELETE',{version:1},String(ad.id))).status,409);
  assert.equal((await pg.query<any>("SELECT count(*)::int AS count FROM listing_audit_logs WHERE action='advertisement_update'")).rows[0].count,1);
  await call('channels','PATCH',{name:'Renamed'},String(channel.id));
  const summary = (await (await call('summaries')).json()).data[0];
  assert.equal(summary.count,2); assert.deepEqual(summary.channels,['Renamed']);
  assert.equal((await call('publications','DELETE',{version:2},String(ad.id))).status,200);
  assert.equal((await (await call('publications')).json()).data.length,1);
  assert.deepEqual((await pg.query('SELECT * FROM listings ORDER BY id')).rows,before);
  assert.equal((await pg.query<any>('SELECT property_name FROM owner_listings')).rows[0].property_name,'Unchanged owner');
  const broken = await handlePublications({ request:new Request('http://localhost'),env:{DATABASE_URL:'test'},resource:'channels' },{...services,connect:()=>{throw new Error('postgres://private:secret@host');}});
  assert.equal(broken.status,500); assert.ok(!(await broken.text()).includes('secret'));
  const app=express();app.use(express.json());app.use('/api',createPublicationsRouter(()=>({DATABASE_URL:'test'}),services));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  try {
    const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
    assert.deepEqual(await (await fetch(`${origin}/api/publication-channels`)).json(),await (await call('channels')).json());
    const payload={...input,url:'https://example.com/parity'};
    const httpResponse=await fetch(`${origin}/api/listings/1/publications`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const direct=await call('publications','POST',payload);
    assert.equal(httpResponse.status,direct.status);assert.deepEqual(await httpResponse.json(),await direct.json());
    authenticated=false;assert.equal((await fetch(`${origin}/api/publication-channels`)).status,401);authenticated=true;
  } finally { await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())); }
  console.log('PASS publication API auth, CRUD, archive, rename, ownership, validation and data preservation');
} finally {await pg.close();}
