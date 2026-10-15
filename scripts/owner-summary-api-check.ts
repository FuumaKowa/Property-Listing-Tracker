import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {handleOwnerListings} from '../functions/api/_owner-listings';
import {ownerListingsTableSql} from '../src/db/ownerListings';
import {promotionFixture} from './owner-promotion-fixture';
const pg=new PGlite();let actor:any={id:1,username:'admin',displayName:'Admin',role:'admin'};
const services:any={authenticate:async()=>actor,connect:()=>({query:async(sql:string,params:any[])=>(await pg.query(sql,params)).rows}),transact:async(_env:any,statements:any[])=>pg.transaction(async tx=>{const results:any[]=[];for(const s of statements){try{results.push((await tx.query(s.sql,s.params)).rows);}catch(e:any){console.error('Local test SQL:',e.code,e.message);throw e;}}return results;})};
const call=(method:string,body?:any)=>handleOwnerListings({env:{DATABASE_URL:'local'},action:'summary-report',request:new Request('https://test/api/owner-listings/summary-report',{method,body:body===undefined?undefined:JSON.stringify(body)})},services);
const report=`SUMMARY LISTING OCTOBER 2026
*14/10/2026*
1. WTL-202610-00019
- Name: Sample Contact A
- Contact: 012-0000146
- Property: Hyde Tower @ i-City, Shah Alam
2. WTS-202610-00008
- Name: Sample Contact B
- Contact: 017-0007775
- Property: Laman Seri, Seksyen 27 Shah Alam
3. WTL-202610-00020
- Name: Sample Contact C
- Contact:019-000 9287
- Property: Agricultural Land / Tanah Untuk Disewa`;
try{
 await pg.exec("CREATE TABLE auth_users(id serial PRIMARY KEY,username text,display_name text,role text);INSERT INTO auth_users VALUES(1,'admin','Admin','admin'),(2,'agent','Agent','user')");
 await pg.exec(ownerListingsTableSql);await promotionFixture(pg);
 for(const name of ['0000_n8n_ingestion','0005_owner_workflow','0006_owner_selangor_coverage','0007_owner_contacted_stage','0009_pause_owner_auto_assignment','0010_owner_summary_reports','0011_listing_report_creation'])await pg.exec(readFileSync('drizzle/'+name+'.sql','utf8'));
 await pg.exec("INSERT INTO owner_listings(owner_name,no_tel,property_name,property_type,property_price,status,updated_by_name,transaction_type) VALUES('Not captured','Not captured','Hyde Tower @ i-City, Shah Alam','highrise',450000,'Unlisted','Original','rent'),('Not captured','0170007775','Laman Seri, Seksyen 27 Shah Alam','landed',750000,'Unlisted','Original','sale'),('Not captured','Not captured','Palm Oil Farm, Klang','land',900000,'Unlisted','Original',NULL)");
 const previewResponse=await call('POST',{mode:'preview',report});assert.equal(previewResponse.status,200,'Summary report preview should be available');
 let preview=(await previewResponse.json()).data;assert.equal(preview.rows.length,3);assert.equal(preview.rows[0].state,'ready');assert.equal(preview.rows[1].state,'ready');assert.equal(preview.rows[2].state,'pending');
 assert.equal((await pg.query('SELECT * FROM listings')).rows.length,0,'Preview never changes listings');
 const choices=preview.rows.filter((r:any)=>r.state==='ready').map((r:any)=>({row:r.entry.row,ownerId:r.selectedOwnerId,version:r.selectedVersion,reference:r.entry.reference}));
 const applied=await call('POST',{mode:'commit',reportId:preview.reportId,choices});assert.equal(applied.status,200);preview=(await applied.json()).data;assert.equal(preview.applied,2);assert.equal(preview.pending,1);
 const owners=(await pg.query<any>('SELECT * FROM owner_listings ORDER BY id')).rows;assert.equal(owners[0].status,'Listed');assert.equal(owners[0].seeding_status,'Contacted');assert.equal(owners[0].owner_name,'Sample Contact A');assert.equal(owners[0].no_tel,'012-0000146');assert.equal(owners[0].property_price,'450000.00');
 const listings=(await pg.query<any>('SELECT * FROM listings ORDER BY id')).rows;assert.equal(listings.length,2);assert.equal(listings[0].project_category,'Rental');assert.equal(listings[1].project_category,'Subsale Direct Listing (SSDL)');assert.ok(listings[0].notes.includes('WTL-202610-00019'));assert.ok(listings[0].notes.includes('2026-10-14'));assert.equal(listings[0].date,'');
 assert.equal((await call('POST',{mode:'commit',reportId:preview.reportId,choices})).status,200,'Retry is idempotent');assert.equal((await pg.query('SELECT * FROM listings')).rows.length,2);
 const list=(await (await call('GET')).json()).data.reports;assert.equal(list[0].pending,1);
 for(let i=0;i<21;i++)await pg.query("INSERT INTO owner_summary_reports(id,created_by,report_text,entry_count,outcomes) VALUES($1,1,'Completed test report',1,'{\"1\":{}}')",[(100+i).toString(16).padStart(64,'0')]);
 assert((await (await call('GET')).json()).data.reports.some((r:any)=>r.id===preview.reportId),'Completed reports never hide older pending reports');
 const reopened=(await (await call('POST',{mode:'preview',reportId:preview.reportId})).json()).data;assert.equal(reopened.pending,1);assert.equal(reopened.rows[0].state,'applied');
 const manual=await call('POST',{mode:'commit',reportId:preview.reportId,choices:[{row:3,ownerId:3,version:1,reference:'WTL-202610-00020'}]});assert.equal(manual.status,200);assert.equal((await manual.json()).data.applied,3);
 assert.equal((await pg.query<any>('SELECT transaction_type FROM owner_listings WHERE id=3')).rows[0].transaction_type,'rent');
 assert.equal((await pg.query('SELECT * FROM owner_listings')).rows.length,3,'Unmatched report never creates an owner record');
 // A different report for the same existing category row must update information, not add another row.
 const revised=report.split('2. WTS')[0].replace('WTL-202610-00019','WTL-202610-00021').replace('Sample Contact A','Sample Contact A Updated');
 const p2=(await (await call('POST',{mode:'preview',report:revised})).json()).data;const target=p2.rows[0];
 assert.equal((await call('POST',{mode:'commit',reportId:p2.reportId,choices:[{row:1,ownerId:1,version:owners[0].version,reference:target.entry.reference}]})).status,200);
 const updated=(await pg.query<any>('SELECT notes FROM listings WHERE source_owner_listing_id=1')).rows[0].notes;assert.ok(updated.includes('WTL-202610-00021'));assert.ok(updated.includes('Sample Contact A Updated'));assert.equal((await pg.query('SELECT * FROM listings')).rows.length,3);
 const dup=`*15/10/2026*\n1. WTL-202610-00040\n- Name: Sample Contact A Updated\n- Contact:012-0000146\n- Property: Hyde Tower @ i-City, Shah Alam\n2. WTL-202610-00040\n- Name: Sample Contact C\n- Contact:019-000 9287\n- Property: Palm Oil Farm, Klang`;
 const duplicate=(await (await call('POST',{mode:'preview',report:dup})).json()).data;assert(duplicate.rows.every((r:any)=>r.state==='pending'));
 const version=(await pg.query<any>('SELECT version FROM owner_listings WHERE id=1')).rows[0].version;
 const choicesDraft=[{row:1,ownerId:1,version,reference:'WTL-202610-00040'},{row:2,ownerId:null,reference:'WTL-202610-00041'}];
 const beforeDraft=(await pg.query('SELECT * FROM owner_listings ORDER BY id')).rows;
 const draft=await call('POST',{mode:'commit',saveOnly:true,reportId:duplicate.reportId,choices:choicesDraft});assert.equal(draft.status,200);assert.deepEqual((await pg.query('SELECT * FROM owner_listings ORDER BY id')).rows,beforeDraft);
 const saved=(await (await call('POST',{mode:'preview',reportId:duplicate.reportId})).json()).data;assert.equal(saved.rows[0].selectedOwnerId,1);assert.equal(saved.rows[1].entry.reference,'WTL-202610-00041');assert.equal(saved.rows[0].entry.issues.length,0);
 await pg.query('UPDATE owner_listings SET version=version+1 WHERE id=1');
 const stale=await call('POST',{mode:'commit',reportId:duplicate.reportId,choices:choicesDraft});assert.equal(stale.status,409);
 assert.equal((await pg.query<any>('SELECT count(*)::int AS n FROM owner_listing_events WHERE action=\'summary_report\' AND after_record->>\'reportReference\'=\'WTL-202610-00040\'')).rows[0].n,0,'Stale match cannot update anything');
 choicesDraft[0].version=version+1;assert.equal((await call('POST',{mode:'commit',reportId:duplicate.reportId,choices:choicesDraft})).status,200);
 // A category write failure rolls back owner status, contacts, audits and report outcomes together.
 const failureReport=revised.replace('WTL-202610-00021','WTL-202610-00050').replace('Sample Contact A Updated','Rollback Owner');
 const failure=(await (await call('POST',{mode:'preview',report:failureReport})).json()).data;
 const currentVersion=(await pg.query<any>('SELECT version FROM owner_listings WHERE id=1')).rows[0].version;
 await pg.exec("ALTER TABLE listings ADD CONSTRAINT reject_report_fixture CHECK (agent IS DISTINCT FROM 'Rollback Owner')");
 const beforeFailure=(await pg.query('SELECT * FROM owner_listings ORDER BY id')).rows;
 const failed=await call('POST',{mode:'commit',reportId:failure.reportId,choices:[{row:1,ownerId:1,version:currentVersion,reference:'WTL-202610-00050'}]});assert.equal(failed.status,500);assert.deepEqual((await pg.query('SELECT * FROM owner_listings ORDER BY id')).rows,beforeFailure);
 assert.deepEqual((await pg.query<any>('SELECT outcomes FROM owner_summary_reports WHERE id=$1',[failure.reportId])).rows[0].outcomes,{});
 actor={id:2,username:'agent',displayName:'Agent',role:'user'};assert.equal((await call('POST',{mode:'preview',reportId:preview.reportId})).status,403,'Reports private to creator/admin');
 const noAccess=(await (await call('POST',{mode:'preview',report:revised})).json()).data;assert.equal(noAccess.rows[0].state,'pending');
 const denied=await call('POST',{mode:'commit',reportId:noAccess.reportId,choices:[{row:1,ownerId:1,version:owners[0].version,reference:target.entry.reference}]});assert.equal(denied.status,403);
 actor=null;assert.equal((await call('GET')).status,401);
 console.log('PASS summary API preview, durable pending/manual matches, owner/category updates, preserved prices, retries and permissions');
}finally{await pg.close();}
