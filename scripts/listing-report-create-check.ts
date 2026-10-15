import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {handleOwnerListings} from '../functions/api/_owner-listings';
import {ownerListingsTableSql} from '../src/db/ownerListings';
import {promotionFixture} from './owner-promotion-fixture';
const pg=new PGlite();let actor:any={id:1,username:'admin',displayName:'Admin',role:'admin'};
const services:any={authenticate:async()=>actor,connect:()=>({query:async(sql:string,params:any[])=>(await pg.query(sql,params)).rows}),transact:async(_env:any,ss:any[])=>pg.transaction(async tx=>{const out=[];for(const s of ss){try{out.push((await tx.query(s.sql,s.params)).rows);}catch(e:any){console.error('Test SQL',e.code,e.message);throw e;}}return out;})};
const call=(action:string,body:any)=>handleOwnerListings({env:{DATABASE_URL:'local'},action,request:new Request('https://test/api/import',{method:'POST',body:JSON.stringify(body)})},services);
const report='FOR SALE | SAMPLE GARDENS, SHAH ALAM • RM1,550,000 NEGOTIABLE\nREF: WTS-202610-00908\n👤 OWNER / ADVERTISER\n* Name: Sample Owner\n* Contact: 017-000 7775\n1. Telegram Channel Team Subsale : https://t.me/sample/5050\n2. Propguru :\n3. Mudah : N/A\n14 Facebook Profile Sample : https://www.facebook.com/share/p/sample/\n20. Whatsapp Broadcast : Done';
try{
 await pg.exec("CREATE TABLE auth_users(id serial PRIMARY KEY,username text,display_name text,role text);INSERT INTO auth_users VALUES(1,'admin','Admin','admin'),(2,'agent','Agent','user')");await pg.exec(ownerListingsTableSql);await promotionFixture(pg);await pg.exec("ALTER TABLE listings ADD COLUMN is_priority boolean DEFAULT false,ADD COLUMN ignored_data_warnings jsonb DEFAULT '[]',ADD COLUMN property_guru_repost_date date,ADD COLUMN property_guru_repost_mode text,ADD COLUMN updated_by_email text,ADD COLUMN created_at timestamp DEFAULT now()");
 for(const name of ['0000_n8n_ingestion','0005_owner_workflow','0006_owner_selangor_coverage','0007_owner_contacted_stage','0009_pause_owner_auto_assignment','0010_owner_summary_reports'])await pg.exec(readFileSync('drizzle/'+name+'.sql','utf8'));
 await pg.exec("CREATE TABLE publication_channels(id serial PRIMARY KEY,name text,archived_at timestamptz);CREATE TABLE listing_publications(id serial PRIMARY KEY,listing_id integer REFERENCES listings(id),channel_id integer REFERENCES publication_channels(id),url text,label text,notes text,version integer DEFAULT 1,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());INSERT INTO publication_channels(name) VALUES('Telegram'),('Facebook')");
 // Apply the new migration once it exists; the initial red test exercises the missing route.
 try{await pg.exec(readFileSync('drizzle/0011_listing_report_creation.sql','utf8'));}catch(e:any){if(e.code!=='ENOENT')throw e;}
 let response=await call('listing-report',{mode:'preview',report});assert.equal(response.status,200,'Own listing reports have a preview endpoint');
 let p=(await response.json()).data;assert.equal(p.property,'SAMPLE GARDENS, SHAH ALAM');assert.equal(p.reference,'WTS-202610-00908');assert.equal(p.links.filter((l:any)=>l.url&&!l.issue).length,2);assert.equal(p.selectedListingId,null);
 assert.equal((await pg.query('SELECT * FROM listings')).rows.length,0,'Preview is read-only');
 const input={mode:'commit',report,listingId:null,createNew:true,category:'Subsale Direct Listing (SSDL)',links:p.links.filter((l:any)=>l.url&&!l.issue).map((l:any)=>({url:l.url,label:l.label,channelId:l.channelId}))};
 response=await call('listing-report',input);assert.equal(response.status,200,await response.clone().text());const result=(await response.json()).data;assert.ok(result.listingId);
 const row=(await pg.query<any>('SELECT * FROM listings')).rows[0];assert.equal(row.status,'Pending');assert.ok(row.notes.includes('RM1,550,000'));assert.ok(row.notes.includes('Pending details'));assert.equal(row.agent,'Sample Owner');assert.equal((await pg.query('SELECT * FROM listing_publications')).rows.length,2);
 assert.equal((await call('listing-report',input)).status,200);assert.equal((await pg.query('SELECT * FROM listings')).rows.length,1,'Retry never creates another property');assert.equal((await pg.query('SELECT * FROM listing_publications')).rows.length,2,'Links deduplicate');
 p=(await (await call('listing-report',{mode:'preview',report})).json()).data;assert.equal(p.selectedListingId,row.id,'Reference matches an existing property');
 assert.equal((await call('listing-report',{...input,listingId:row.id,version:0})).status,400);
 // Existing listings retain schedules, notes and their lifecycle status.
 await pg.query("UPDATE listings SET date='2099-12-31',status='Active',notes=notes||E'\nOriginal notes' WHERE id=$1",[row.id]);
 const edited=report.replace('Sample Owner','Updated Sample Owner');
 response=await call('listing-report',{...input,report:edited,listingId:row.id,version:row.version});assert.equal(response.status,200,await response.clone().text());
 let current=(await pg.query<any>('SELECT * FROM listings WHERE id=$1',[row.id])).rows[0];assert.equal(current.date,'2099-12-31');assert.equal(current.status,'Active');assert.ok(current.notes.includes('Original notes'));assert.equal(current.agent,'Updated Sample Owner');
 assert.equal((await call('listing-report',{...input,report:edited,listingId:row.id,version:row.version})).status,409,'Stale edits rejected');
 await pg.query('UPDATE listings SET archived_at=now() WHERE id=$1',[row.id]);response=await call('listing-report',{...input,report:edited,listingId:row.id,version:current.version});assert.equal(response.status,200,await response.clone().text());assert.equal((await pg.query<any>('SELECT archived_at FROM listings WHERE id=$1',[row.id])).rows[0].archived_at,null);
 // Link failure must roll back newly inserted property and reference rows as well.
 await pg.exec("ALTER TABLE listing_publications ADD CONSTRAINT reject_fixture CHECK(url NOT LIKE '%rollback%')");
 const badReport=report.replace('SAMPLE GARDENS','ROLLBACK GARDENS').replace('00908','00909').replace('https://t.me/sample/5050','https://t.me/rollback/5050');
 response=await call('listing-report',{...input,report:badReport,links:[{channelId:1,url:'https://t.me/rollback/5050',label:'Telegram'}]});assert.equal(response.status,500);assert.equal((await pg.query("SELECT * FROM listings WHERE property LIKE 'ROLLBACK%'")).rows.length,0);assert.equal((await pg.query("SELECT * FROM listing_report_references WHERE reference='WTS-202610-00909'")).rows.length,0);await pg.exec('ALTER TABLE listing_publications DROP CONSTRAINT reject_fixture');
 const summary='*15/10/2026*\n1. WTL-202610-00999\n- Name: New Sample Owner\n- Contact: 012-0001234\n- Property: Missing Sample Apartment';
 p=(await (await call('summary-report',{mode:'preview',report:summary})).json()).data;
 response=await call('summary-report',{mode:'commit',reportId:p.reportId,choices:[{row:1,ownerId:null,createNew:true,reference:'WTL-202610-00999'}]});assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).data.applied,1);
 const owner=(await pg.query<any>('SELECT * FROM owner_listings')).rows[0];assert.equal(owner.property_type,'pending');assert.equal(owner.property_price,null);assert.equal(owner.status,'Listed');assert.equal(owner.seeding_status,'Contacted');assert.equal(owner.assigned_agent_id,null);
 assert.equal((await call('summary-report',{mode:'commit',reportId:p.reportId,choices:[{row:1,ownerId:null,createNew:true}]})).status,200);assert.equal((await pg.query('SELECT * FROM owner_listings')).rows.length,1);
 assert.equal((await pg.query<any>("SELECT * FROM listings WHERE source_owner_listing_id=$1",[owner.id])).rows[0].status,'Pending');
 // Own-report first, then owner summary: keep one category row and its ads.
 const ownerLater='*15/10/2026*\n1. WTS-202610-00908\n- Name: Sample Owner\n- Contact: 017-0007775\n- Property: SAMPLE GARDENS, SHAH ALAM';
 p=(await (await call('summary-report',{mode:'preview',report:ownerLater})).json()).data;response=await call('summary-report',{mode:'commit',reportId:p.reportId,choices:[{row:1,ownerId:null,createNew:true}]});assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).data.applied,1);assert.equal((await pg.query("SELECT * FROM listings WHERE property='SAMPLE GARDENS, SHAH ALAM'")).rows.length,1);assert.equal((await pg.query('SELECT * FROM listing_publications')).rows.length,2);
 actor=null;assert.equal((await call('listing-report',{mode:'preview',report})).status,401);
 console.log('PASS own listing report preview/create/retry/reference/ads, missing owner creation with unknown details and assignment pause');
}finally{await pg.close();}
