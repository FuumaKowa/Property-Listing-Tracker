import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {ownerListingsTableSql} from '../src/db/ownerListings';
import {promotionFixture} from './owner-promotion-fixture';
import {DatabaseWorkflowStore} from '../src/server/workflow/database';
import {seedWorkflow,previewUsers} from '../src/workflow/seed';
import {productionContext} from '../src/server/workflow/production-runner';
const pg=new PGlite();
const db={query:async(sql:string,params?:unknown[])=>(await pg.query(sql,params)).rows as any[]};
const transact=async<T>(fn:(tx:typeof db)=>Promise<T>)=>pg.transaction(tx=>fn({query:async(sql,params)=>(await tx.query(sql,params)).rows as any[]}));
const context={actual:previewUsers[0],effective:previewUsers[0]};
const store=new DatabaseWorkflowStore(db,transact,previewUsers);
const brief={...seedWorkflow()[0].brief,reference:'WTS-202610-TEST1',property:'Integration test land',phone:'0190001234',ownerName:'Test owner',sourceUrl:'',price:'RM500,000',permission:true,tasks:[]};
try{
 await pg.exec("CREATE TABLE auth_users(id serial PRIMARY KEY,username text,display_name text,role text); CREATE TABLE auth_sessions(session_token_hash text UNIQUE,user_id int,expires_at timestamp); INSERT INTO auth_users(id,username,display_name,role) VALUES(1,'Daniel','Daniel','super_admin'),(2,'Eypa','Eypa','admin'),(3,'Luqman','Luqman','admin'),(4,'drshahril74','Dr Shahril','admin'),(5,'Muz','Muz','admin')");
 await pg.exec(ownerListingsTableSql);await promotionFixture(pg);
 for(const name of ['0000_n8n_ingestion','0001_publication_channels','0005_owner_workflow','0006_owner_selangor_coverage','0007_owner_contacted_stage','0009_pause_owner_auto_assignment','0010_owner_summary_reports','0011_listing_report_creation','0012_marketing_workflow'])await pg.exec(readFileSync('drizzle/'+name+'.sql','utf8'));
 let w=await store.create(brief,context);assert.ok(w.links?.ownerId);assert.ok(w.links?.listingId);
 const ownerId=w.links!.ownerId,listingId=w.links!.listingId;
 assert.equal((await db.query('SELECT status,seeding_status FROM owner_listings WHERE id=$1',[ownerId]))[0].status,'Listed');
 assert.equal((await db.query('SELECT project_category FROM listings WHERE id=$1',[listingId]))[0].project_category,'Subsale Direct Listing (SSDL)');
 assert.equal((await db.query('SELECT asking_price FROM listings WHERE id=$1',[listingId]))[0].asking_price,'500000.00','Workflow price is synchronized to the category listing as a numeric amount');
 const retry=await store.create(brief,context);assert.equal(retry.id,w.id);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM owner_listings'))[0].n,1);
 await db.query("UPDATE listings SET notes='Manual note',pm='Existing agent',location='Edited in sheet' WHERE id=$1",[listingId]);
 w=await store.action(w.id,w.version,{type:'handoff'},context);
 let row=(await db.query('SELECT * FROM listings WHERE id=$1',[listingId]))[0];assert.equal(row.location,'Edited in sheet');assert.equal(row.pm,'Existing agent');assert.ok(row.notes.startsWith('Manual note'));
 w=await store.action(w.id,w.version,{type:'saveBrief',brief:{...w.brief,phone:'0199998888',price:'',location:'Updated location'}},context);
 row=(await db.query('SELECT * FROM listings WHERE id=$1',[listingId]))[0];assert.equal(row.location,'Updated location');assert.equal(row.no_tel,'0199998888');assert.equal((await db.query('SELECT property_price FROM owner_listings WHERE id=$1',[ownerId]))[0].property_price,'500000.00');
 await assert.rejects(()=>store.action(w.id,w.version-1,{type:'handoff'},context),/changed|Refresh/i);
 // Withdrawing and restoring permission preserves the same category record and history.
 w=await store.action(w.id,w.version,{type:'saveBrief',brief:{...w.brief,permission:false}},context);
 assert.equal((await db.query('SELECT status FROM owner_listings WHERE id=$1',[ownerId]))[0].status,'Unlisted');
 assert.ok((await db.query('SELECT archived_at FROM listings WHERE id=$1',[listingId]))[0].archived_at);
 w=await store.action(w.id,w.version,{type:'saveBrief',brief:{...w.brief,permission:true}},context);
 assert.equal(w.links!.listingId,listingId);assert.equal((await db.query('SELECT archived_at FROM listings WHERE id=$1',[listingId]))[0].archived_at,null);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM listings WHERE source_owner_listing_id=$1',[ownerId]))[0].n,1);
 assert.ok((await db.query('SELECT notes FROM listings WHERE id=$1',[listingId]))[0].notes.includes('Manual note'));
 // An existing report-only category is reused and linked to its new owner.
 await db.query("INSERT INTO listings(property,project_category,location,notes,status,version) VALUES('Existing rental','Rental','Sepang','Keep report notes','Active',1)");
 const existing=(await db.query("SELECT id FROM listings WHERE property='Existing rental'"))[0].id;
 await db.query("INSERT INTO listing_report_references(reference,listing_id) VALUES('WTL-202610-TEST2',$1)",[existing]);
 const rental=await store.create({...brief,reference:'WTL-202610-TEST2',property:'Existing rental',category:'Rental',phone:'0182223333'},context);
 assert.equal(rental.links!.listingId,existing);assert.ok((await db.query('SELECT notes FROM listings WHERE id=$1',[existing]))[0].notes.includes('Keep report notes'));
 await assert.rejects(()=>store.create({...brief,reference:'WTS-202610-OTHER',phone:'0199998888'},context),/workflow|linked/i);
 // Ambiguous same-property owners must be resolved manually, not duplicated.
 for(const phone of ['0111000001','0111000002'])await db.query("INSERT INTO owner_listings(owner_name,no_tel,property_name,property_type,property_price,status,updated_by_name,transaction_type) VALUES('Owner',$1,'Same condominium','highrise',1000,'Unlisted','Tester','rent')",[phone]);
 const ambiguous={...brief,reference:'WTL-202610-AMBIG',property:'Same condominium',category:'Rental' as const,phone:''};
 await assert.rejects(()=>store.create(ambiguous,context),/match|choose|multiple/i);
 const picked=(await db.query("SELECT id FROM owner_listings WHERE property_name='Same condominium' ORDER BY id"))[0].id;
 const manual=await store.create(ambiguous,context,{ownerId:picked});assert.equal(manual.links!.ownerId,picked);
 // A single same-building match is still uncertain when either contact is missing.
 await db.query("INSERT INTO owner_listings(owner_name,no_tel,property_name,property_type,property_price,status,updated_by_name,transaction_type) VALUES('Keep this owner','0111000055','Single shared building','highrise',1000,'Unlisted','Tester','rent')");
 await assert.rejects(()=>store.create({...ambiguous,reference:'WTL-202610-MISSING',property:'Single shared building',ownerName:'Different owner'},context),/matches need review/);
 assert.equal((await db.query("SELECT owner_name FROM owner_listings WHERE property_name='Single shared building'"))[0].owner_name,'Keep this owner');
 // Reference and original source must not point at different owners.
 await db.query("UPDATE owner_listings SET property_link='https://example.com/another-owner' WHERE id=$1",[picked]);
 await db.query("INSERT INTO owner_listing_events(listing_id,action,actor_name,after_record) VALUES($1,'summary_report','Tester',$2::jsonb)",[ownerId,JSON.stringify({reportReference:'WTS-202610-CONFLICT'})]);
 await assert.rejects(()=>store.create({...brief,reference:'WTS-202610-CONFLICT',sourceUrl:'https://example.com/another-owner'},context),/multiple owner records/);
 // Any downstream failure rolls back all rows, reference and workflow changes.
 await pg.exec("ALTER TABLE listings ADD CONSTRAINT reject_workflow_fixture CHECK(property<>'Rollback property')");
 const before=(await db.query('SELECT count(*)::int AS n FROM owner_listings'))[0].n;
 await assert.rejects(()=>store.create({...brief,reference:'WTS-202610-ROLLBACK',property:'Rollback property',phone:'0184445555'},context));
 assert.equal((await db.query('SELECT count(*)::int AS n FROM owner_listings'))[0].n,before);
 // Automatic handoff uses the same owner/category links and rejects an externally unlisted owner.
 let auto=await store.create({...brief,reference:'WTS-AUTO-SYNC',property:'Automatic integration fixture',phone:'0129990000'},context);
 const autoOwner=auto.links!.ownerId,autoListing=auto.links!.listingId;
 auto=await store.action(auto.id,auto.version,{type:'addMaterial',kind:'photo',title:'Source',fileKey:'source.jpg',mime:'image/jpeg',original:true},context);
 auto=await store.action(auto.id,auto.version,{type:'startProduction',provider:'template'},context);
 const worker=productionContext(auto);assert.equal(worker.effective.name,'Automation');assert.equal(worker.actual.id,context.actual.id);
 auto=await store.action(auto.id,auto.version,{type:'productionWorker',operation:'claim',runId:auto.production!.id},worker);
 const finish={type:'productionWorker' as const,operation:'complete' as const,runId:auto.production!.id,leaseToken:auto.production!.leaseToken,outputs:[{kind:'copy' as const,title:'Copy',text:'Generated test copy'},{kind:'poster' as const,title:'Poster',fileKey:'poster.jpg',mime:'image/jpeg'},{kind:'video' as const,title:'Video',fileKey:'video.mp4',mime:'video/mp4'}]};
 await db.query("UPDATE owner_listings SET status='Unlisted' WHERE id=$1",[autoOwner]);
 await assert.rejects(()=>store.action(auto.id,auto.version,finish,worker),/unlisted|archived/i);
 await db.query("UPDATE owner_listings SET status='Listed' WHERE id=$1",[autoOwner]);
 auto=await store.action(auto.id,auto.version,finish,worker);
 assert.equal(auto.links!.ownerId,autoOwner);assert.equal(auto.links!.listingId,autoListing);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM listings WHERE source_owner_listing_id=$1',[autoOwner]))[0].n,1);
 assert.ok((await db.query('SELECT notes FROM listings WHERE id=$1',[autoListing]))[0].notes.includes('Generated test copy'));
 console.log('PASS workflow synchronization, duplicate matching, automatic handoff, unlisted protection, stale writes and rollback');
}finally{await pg.close();}
