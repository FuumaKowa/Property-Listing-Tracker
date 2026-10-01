import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import express from 'express';
import {once} from 'node:events';
import {createListingsRouter} from '../src/server/listings';
assert(existsSync('functions/api/_listings.ts'),'Shared audited listing service must exist');
const {handleListings}=await import('../functions/api/_listings');
const pg=new PGlite();
try {
 await pg.exec(`CREATE TABLE listings(id serial PRIMARY KEY,property text NOT NULL,project_category text,location text,tenure text,pm text,negotiator text,agent text,no_tel text,available_units text,status text,date text,renew_status text,notes text,updated_by_user_id text,updated_by_name text,updated_by_email text,last_updated_at timestamp DEFAULT now(),created_at timestamp DEFAULT now());
 CREATE TABLE listing_audit_logs(id serial PRIMARY KEY,listing_id integer NOT NULL REFERENCES listings(id) ON DELETE CASCADE,action text NOT NULL,changed_fields text,user_name text,user_uid text,user_email text,timestamp timestamp DEFAULT now());
 CREATE TABLE owner_listings(id serial PRIMARY KEY,property_name text);INSERT INTO owner_listings(property_name) VALUES('Preserved owner');
 INSERT INTO listings(property,location,pm) VALUES('Legacy','KL','Old PM');`);
 for(const file of ['0001_publication_channels','0002_listing_creator_priority','0003_listing_safety','0004_daily_work'])await pg.exec(readFileSync(`drizzle/${file}.sql`,'utf8'));
 let user:any={id:7,username:'creator',displayName:'Creator',role:'user'};
 const services:any={getSessionUser:async()=>user,getDb:()=>({query:async(sql:string,params:unknown[])=>(await pg.query(sql,params)).rows})};
 const call=async(method:string,body?:unknown,id?:number,restore=false)=>handleListings({env:{DATABASE_URL:'test'},request:new Request('https://test/api/listings',{method,body:body===undefined?undefined:JSON.stringify(body)}),id:id===undefined?undefined:String(id),restore},services);
 let r=await call('POST',{property:'New',location:'KL',pm:'Lister',createdByName:'Fake'});assert.equal(r.status,201);const created=(await r.json()).data;
 assert.equal(created.version,1);assert.equal(created.createdByName,'Creator');
 user={...user,id:8,displayName:'Editor'};
 r=await call('PATCH',{version:1,pm:'Updated lister',isPriority:true,createdByName:'Spoof'},created.id);assert.equal(r.status,200);const edited=(await r.json()).data;assert.equal(edited.version,2);assert.equal(edited.createdByName,'Creator');
 assert.equal((await call('PATCH',{version:1,pm:'Stale'},created.id)).status,409);
 assert.equal((await call('PATCH',{pm:'No version'},created.id)).status,428);
 assert.equal((await call('DELETE',{version:1},created.id)).status,409);
 await pg.query("INSERT INTO listing_publications(listing_id,channel_id,url) VALUES($1,1,'https://example.com/retained')",[created.id]);
 r=await call('DELETE',{version:2},created.id);assert.equal(r.status,200);const archived=(await r.json()).data;assert(archived.archivedAt);assert.equal(archived.version,3);
 assert.equal((await call('PATCH',{version:3,pm:'Archived edit'},created.id)).status,409);
 assert(!(await (await call('GET')).json()).data.some((l:any)=>l.id===created.id));
 assert.equal((await pg.query('SELECT count(*)::int AS count FROM listing_publications')).rows[0].count,1);
 r=await call('POST',{version:3},created.id,true);assert.equal(r.status,200);const restored=(await r.json()).data;assert.equal(restored.archivedAt,null);assert.equal(restored.pm,'Updated lister');assert.equal(restored.version,4);
 const logs=(await pg.query<any>('SELECT * FROM listing_audit_logs ORDER BY id')).rows;assert.deepEqual(logs.map(l=>l.action),['create','update','archive','restore']);
 const change=JSON.parse(logs[1].changed_fields);assert.equal(change.before.pm,'Lister');assert.equal(change.after.pm,'Updated lister');assert.equal(logs[1].user_name,'Editor');
 assert.equal((await pg.query('SELECT property_name FROM owner_listings')).rows[0].property_name,'Preserved owner');
 const race=await Promise.all([call('PATCH',{version:4,notes:'First concurrent edit'},created.id),call('PATCH',{version:4,notes:'Second concurrent edit'},created.id)]);
 assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
 const app=express();app.use(express.json());app.use('/api',createListingsRouter(()=>({DATABASE_URL:'test'}),services));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 try {
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  assert.deepEqual(await (await fetch(origin+'/api/listings')).json(),await (await call('GET')).json());
  const httpConflict=await fetch(origin+'/api/listings/'+created.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:4,notes:'Stale HTTP'})});
  assert.equal(httpConflict.status,409);
  assert.equal((await fetch(origin+'/api/listings/'+created.id,{method:'DELETE',headers:{'Content-Type':'application/json'},body:'{}'})).status,428);
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
 r=await call('PATCH',{version:5,ignoredDataWarnings:['phone','links']},created.id);assert.equal(r.status,200);assert.deepEqual((await r.json()).data.ignoredDataWarnings,['phone','links']);
 assert.equal((await call('PATCH',{version:5,ignoredDataWarnings:[]},created.id)).status,409);
 assert.equal((await call('PATCH',{version:6,ignoredDataWarnings:['unknown']},created.id)).status,400);
 r=await call('PATCH',{version:6,ignoredDataWarnings:[]},created.id);assert.equal(r.status,200);assert.deepEqual((await r.json()).data.ignoredDataWarnings,[]);
 assert.equal((await pg.query<any>('SELECT pm,created_by_name FROM listings WHERE id=$1',[created.id])).rows[0].pm,'Updated lister');
 // An audit failure must roll back the listing update.
 await pg.exec("ALTER TABLE listing_audit_logs ADD CONSTRAINT reject_update CHECK(action <> 'update') NOT VALID");
 assert.equal((await call('PATCH',{version:7,pm:'Must roll back'},created.id)).status,500);
 assert.equal((await pg.query<any>('SELECT version,pm FROM listings WHERE id=$1',[created.id])).rows[0].version,7);
 user=null;assert.equal((await call('GET')).status,401);assert.equal((await call('DELETE',{version:4},created.id)).status,401);
 console.log('PASS atomic audit, before/after values, creator preservation, stale save/archive rejection, required versions, archive/restore with links retained, auth, owner isolation and audit-failure rollback');
}finally{await pg.close();}
