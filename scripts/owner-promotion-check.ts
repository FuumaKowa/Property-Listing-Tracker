import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { handleOwnerListings } from '../functions/api/_owner-listings';
import { ownerListingsTableSql } from '../src/db/ownerListings';

const pg = new PGlite();
let user = {id:1,username:'admin',displayName:'Admin',role:'admin'};
const services:any = {authenticate:async()=>user,connect:()=>({query:async(sql:string,params:any[]) => (await pg.query(sql,params)).rows})};
const input = {ownerName:'Owner',noTel:'012345',propertyName:'Test property',location:'Ampang',propertyType:'landed',propertyPrice:'380000.25',status:'Unlisted',propertyLink:'https://example.com/post'};
async function call(method:string,body:any,id?:number,action?:string) {
 return handleOwnerListings({env:{DATABASE_URL:'local'},params:id?{id:String(id)}:undefined,action,request:new Request('https://test/api/owner-listings',{method,body:JSON.stringify(body)})},services);
}
async function update(id:number,body:any,action?:string) {
 const row:any=(await pg.query('SELECT version FROM owner_listings WHERE id=$1',[id])).rows[0];
 return call('PATCH',{version:row.version,...body},id,action);
}
try {
 await pg.exec(`CREATE TABLE auth_users(id serial PRIMARY KEY,username text,display_name text,role text);INSERT INTO auth_users VALUES(1,'admin','Admin','admin'),(2,'agent','Agent','user');
 CREATE TABLE listings(id serial PRIMARY KEY,property text NOT NULL,project_category text,location text NOT NULL,tenure text,pm text,negotiator text,agent text,no_tel text,available_units text,asking_price numeric(18,2),status text,date text,renew_status text,notes text,created_by_user_id text,created_by_name text,updated_by_user_id text,updated_by_name text,last_updated_at timestamp,version integer DEFAULT 1,archived_at timestamp,archived_by_name text);
 CREATE TABLE listing_audit_logs(id serial PRIMARY KEY,listing_id integer,action text,changed_fields text,user_uid text,user_name text);`);
 await pg.exec('CREATE TABLE listing_publications(id serial PRIMARY KEY,listing_id integer REFERENCES listings(id),url text)');
 await pg.exec(ownerListingsTableSql);
 for(const tag of ['0000_n8n_ingestion','0005_owner_workflow','0006_owner_selangor_coverage','0007_owner_contacted_stage']) await pg.exec(readFileSync(`drizzle/${tag}.sql`,'utf8'));
 await pg.exec("INSERT INTO owner_listings(owner_name,no_tel,property_name,property_type,property_price,status,updated_by_name,transaction_type) VALUES('Existing','012','Previously listed','landed',100,'Listed','Admin','sale')");
 const beforeMigration=(await pg.query('SELECT * FROM owner_listings')).rows;
 // Before adding the migration, demonstrate the missing automatic creation.
 const migration='drizzle/0008_owner_promotion.sql';
 try {await pg.exec(readFileSync(migration,'utf8'));} catch(e:any) {if(e.code!=='ENOENT')throw e;}
 assert.deepEqual((await pg.query('SELECT * FROM owner_listings')).rows,beforeMigration,'Migration preserves existing owner records');
 assert.equal((await pg.query('SELECT * FROM listings')).rows.length,0,'Previously Listed records are not automatically backfilled');
 const legacy:any=beforeMigration[0];
 await pg.query('UPDATE owner_listings SET transaction_type=NULL WHERE id=$1',[legacy.id]);
 assert.equal((await update(legacy.id,{status:'Listed',transactionType:'rent'},'activity')).status,200,'Existing Listed row can save a missing category choice');
 assert.equal((await pg.query('SELECT * FROM listings')).rows.length,0,'Selecting a category for an already Listed row does not backfill it');
 for(const [type,category] of [['rent','Rental'],['sale','Subsale Direct Listing (SSDL)']]) {
  const response=await call('POST',{...input,transactionType:type});assert.equal(response.status,201);
  const owner=(await response.json()).data;
  await pg.query('UPDATE owner_listings SET transaction_type=$1 WHERE id=$2',[type,owner.id]);
  assert.equal((await update(owner.id,{status:'Listed'},'activity')).status,200);
  const listing:any=(await pg.query('SELECT * FROM listings WHERE property=$1 ORDER BY id DESC',[input.propertyName])).rows[0];
  assert.ok(listing,'Listed owner must create a category listing');
  assert.equal(listing.project_category,category);assert.equal(listing.no_tel,input.noTel);
  assert.equal(listing.status,'Active');assert.equal(listing.date,'','Do not invent an expiry date');assert.equal(listing.created_by_user_id,'1');
  assert.equal(listing.asking_price,'380000.25','Promotion carries the numeric owner price to the category listing');
  assert.ok(listing.notes.includes('380000.25'));assert.ok(listing.notes.includes(input.propertyLink));
  await pg.query('INSERT INTO listing_publications(listing_id,url) VALUES($1,$2)',[listing.id,'https://example.com/saved-ad']);
  assert.equal((await update(owner.id,{status:'Unlisted'},'activity')).status,200);
  const withdrawn:any=(await pg.query('SELECT * FROM listings WHERE source_owner_listing_id=$1',[owner.id])).rows[0];
  assert.ok(withdrawn.archived_at,'Unlisted owner must disappear from the active category sheet');
  assert.equal(withdrawn.version,listing.version+1,'Withdrawal invalidates stale category saves');
  assert.equal((await update(owner.id,{status:'Listed'},'activity')).status,200);
  const restored:any=(await pg.query('SELECT * FROM listings WHERE source_owner_listing_id=$1',[owner.id])).rows[0];
  assert.equal(restored.id,listing.id);assert.equal(restored.archived_at,null,'Relisting restores the previous category row');
  assert.equal(restored.version,withdrawn.version+1);
  assert.equal(restored.notes,listing.notes);assert.equal(restored.created_by_user_id,listing.created_by_user_id);
  assert.equal((await pg.query('SELECT * FROM listings WHERE source_owner_listing_id=$1',[owner.id])).rows.length,1);
  await pg.query("UPDATE listings SET status='Sold Out',archived_at=now() WHERE source_owner_listing_id=$1",[owner.id]);
  await update(owner.id,{status:'Unlisted'},'activity');
  await update(owner.id,{status:'Listed',transactionType:type==='rent'?'sale':'rent'},'activity');
  const preserved:any=(await pg.query('SELECT * FROM listings WHERE source_owner_listing_id=$1',[owner.id])).rows[0];
  assert.equal(preserved.status,'Sold Out');assert.equal(preserved.archived_at,null,'Deleted category row becomes visible again when owner is relisted');assert.equal(preserved.project_category,category);
  assert.deepEqual((await pg.query('SELECT url FROM listing_publications WHERE listing_id=$1',[listing.id])).rows,[{url:'https://example.com/saved-ad'}]);
 }
 const unknown=(await (await call('POST',input)).json()).data;
 assert.equal((await update(unknown.id,{status:'Listed'},'activity')).status,400);
 assert.equal((await update(unknown.id,{status:'Listed',transactionType:'auction'},'activity')).status,400);
 assert.equal((await update(unknown.id,{status:'Listed',transactionType:'rent'},'activity')).status,200);
 assert.equal((await pg.query<any>('SELECT transaction_type FROM owner_listings WHERE id=$1',[unknown.id])).rows[0].transaction_type,'rent');
 const edited=(await (await call('POST',input)).json()).data;
 assert.equal((await update(edited.id,{...input,status:'Listed',transactionType:'sale'})).status,200);
 assert.equal((await update(edited.id,{status:'Rejected'},'activity')).status,200);
 assert.ok((await pg.query<any>('SELECT archived_at FROM listings WHERE source_owner_listing_id=$1',[edited.id])).rows[0].archived_at);
 assert.equal((await update(edited.id,{status:'Listed'},'activity')).status,200);
 assert.equal((await call('POST',{...input,status:'Listed'})).status,400);
 assert.equal((await call('POST',{...input,status:'Listed',transactionType:'rent'})).status,201);
 const unsupported=(await (await call('POST',input)).json()).data;
 await pg.query("UPDATE owner_listings SET transaction_type='Rental' WHERE id=$1",[unsupported.id]);
 assert.equal((await update(unsupported.id,{status:'Listed',transactionType:'rent'},'activity')).status,200,'Explicit choice corrects unsupported imported transaction type');
 // Failure in destination insertion must roll back status and event together.
 const rollback=(await (await call('POST',{...input,transactionType:'sale'})).json()).data;
 const beforeFailure=(await pg.query('SELECT * FROM owner_listing_events WHERE listing_id=$1',[rollback.id])).rows;
 await pg.exec("ALTER TABLE listings ADD CONSTRAINT reject_failure_fixture CHECK (property <> 'Force rollback')");
 const failed=await update(rollback.id,{...input,propertyName:'Force rollback',status:'Listed',transactionType:'sale'});
 assert.equal(failed.status,500);
 assert.equal((await pg.query<any>('SELECT status FROM owner_listings WHERE id=$1',[rollback.id])).rows[0].status,'Unlisted');
 assert.deepEqual((await pg.query('SELECT * FROM owner_listing_events WHERE listing_id=$1',[rollback.id])).rows,beforeFailure);
 const stale=await call('PATCH',{version:1,status:'Listed',transactionType:'sale'},unknown.id,'activity');
 assert.equal(stale.status,409);
 user={id:2,username:'agent',displayName:'Agent',role:'user'};
 assert.equal((await update(edited.id,{status:'Unlisted'},'activity')).status,403);
 await pg.query("UPDATE owner_listings SET assigned_agent_id=2,assigned_agent_name='Agent' WHERE id=$1",[rollback.id]);
 assert.equal((await update(rollback.id,{status:'Listed'},'activity')).status,200,'Assigned agent can promote the owner');
 const assigned:any=(await pg.query('SELECT * FROM listings WHERE source_owner_listing_id=$1',[rollback.id])).rows[0];
 assert.equal(assigned.created_by_user_id,'2');assert.equal(assigned.pm,'Agent');assert.equal(assigned.agent,'Owner');
 assert.equal((await pg.query('SELECT * FROM listings')).rows.length,7);
 assert.equal((await pg.query("SELECT * FROM listing_audit_logs WHERE action='create'")).rows.length,7);
 assert.equal((await pg.query("SELECT * FROM listing_audit_logs WHERE action='archive'")).rows.length,3);
 assert.equal((await pg.query("SELECT * FROM listing_audit_logs WHERE action='restore'")).rows.length,5);
 console.log('PASS owner promotion: routing, missing/invalid choices, create/edit/follow-up, deduplication, permissions and audits');
} finally {await pg.close();}
