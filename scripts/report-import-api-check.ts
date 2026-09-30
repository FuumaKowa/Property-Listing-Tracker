import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import { once } from 'node:events';
import { handlePublications, type PublicationsServices } from '../functions/api/_publications';
import { createPublicationsRouter } from '../src/server/publications/express';
const pg = new PGlite();
let authenticated = true;
const services: PublicationsServices = {
  authenticate: async () => authenticated ? {id:1,username:'tester',displayName:'Tester',role:'user'} : null,
  connect: () => ({query:async (sql,params)=>(await pg.query<Record<string,any>>(sql,params)).rows}),
  transact: async (_env,statements) => pg.transaction(async tx => {
    const results:Record<string,any>[][]=[];
    for(const statement of statements) results.push((await tx.query<Record<string,any>>(statement.sql,statement.params)).rows);
    return results;
  }),
};
const input={channelId:3,url:'https://t.me/test/781',label:'Tele Nhc Coa'};
const call=(items:unknown,listingId='1')=>handlePublications({resource:'import',listingId,env:{DATABASE_URL:'test'},request:new Request('https://example.com/api',{method:'POST',body:JSON.stringify({items})})},services);
try {
  await pg.exec("CREATE TABLE listings(id serial PRIMARY KEY,property text); INSERT INTO listings(property) VALUES ('Keep this'),('Other'); CREATE TABLE owner_listings(id serial PRIMARY KEY,property_name text); INSERT INTO owner_listings(property_name) VALUES ('Keep owner')");
  await pg.exec(readFileSync('drizzle/0001_publication_channels.sql','utf8'));
  await pg.exec(readFileSync('drizzle/0003_listing_safety.sql','utf8'));
  await pg.exec('CREATE TABLE listing_audit_logs(id serial PRIMARY KEY,listing_id integer REFERENCES listings(id),action text,changed_fields text,user_uid text,user_name text)');
  const before=(await pg.query('SELECT * FROM listings ORDER BY id')).rows;
  const existing=(await pg.query("INSERT INTO listing_publications(listing_id,channel_id,url,label,notes) VALUES(1,3,'https://t.me/test/old','Keep label','Keep notes') RETURNING *")).rows[0];
  authenticated=false;assert.equal((await call([input])).status,401);authenticated=true;
  const first=await call([input,input,{channelId:3,url:'https://t.me/test/old'}]);
  assert.equal(first.status,200,'Bulk import endpoint must accept reviewed links');
  const result=(await first.json()).data;
  assert.equal(result.added,1);assert.equal(result.skipped,2);assert.equal(result.links.length,2);
  assert.equal((await (await call([input])).json()).data.added,0,'Retry must not duplicate a committed import');
  await pg.exec("INSERT INTO listing_publications(listing_id,channel_id,url,label) VALUES(1,3,'https://EXAMPLE.com','Legacy URL')");
  assert.equal((await (await call([{...input,url:'https://example.com/'}])).json()).data.added,0,'Normalize legacy URLs for duplicate checks');
  const simultaneous=await Promise.all([call([{...input,url:'https://t.me/test/concurrent'}]),call([{...input,url:'https://t.me/test/concurrent'}])]);
  assert.equal((await simultaneous[0].json()).data.added+(await simultaneous[1].json()).data.added,1);
  assert.deepEqual((await pg.query('SELECT * FROM listing_publications WHERE id=$1',[existing.id])).rows[0],existing);
  assert.equal((await pg.query<any>("SELECT count(*)::int AS n FROM listing_audit_logs WHERE user_name='Tester' AND action='advertisement_create'")).rows[0].n,2);
  assert.equal((await call([{...input,url:'javascript:alert(1)'}])).status,400);
  assert.equal((await call([input,{...input,channelId:999,url:'https://t.me/test/invalid'}])).status,400);
  await pg.exec('UPDATE publication_channels SET archived_at=now() WHERE id=2');
  assert.equal((await call([{...input,channelId:2}])).status,400);
  assert.equal((await call(Array(101).fill(input))).status,400);
  assert.equal((await call([input],'999')).status,404);
  await pg.exec('UPDATE listings SET archived_at=now() WHERE id=2');
  assert.equal((await call([input],'2')).status,409);
  await pg.exec("ALTER TABLE listing_audit_logs ADD CONSTRAINT reject_new CHECK (user_name <> 'Tester') NOT VALID");
  assert.equal((await call([{...input,url:'https://t.me/test/rollback'}])).status,500);
  assert.equal((await pg.query<any>("SELECT count(*)::int AS n FROM listing_publications WHERE url LIKE '%rollback'")).rows[0].n,0);
  await pg.exec('ALTER TABLE listing_audit_logs DROP CONSTRAINT reject_new');
  const app=express();app.use(express.json());app.use('/api',createPublicationsRouter(()=>({DATABASE_URL:'test'}),services));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  try {
    const r=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/listings/1/publications/import`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[input]})});
    assert.equal(r.status,200);assert.deepEqual(await r.json(),await (await call([input])).json());
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
  assert.deepEqual((await pg.query('SELECT * FROM listings WHERE id=1')).rows[0],before[0]);
  assert.equal((await pg.query<any>('SELECT property_name FROM owner_listings')).rows[0].property_name,'Keep owner');
  console.log('PASS import auth, retry/concurrent deduplication, existing links unchanged, audit rollback, validation, archived property/channel rejection, Express parity and owner isolation');
} finally {await pg.close();}
