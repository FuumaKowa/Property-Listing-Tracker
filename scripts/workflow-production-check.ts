import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {ownerListingsTableSql} from '../src/db/ownerListings';
import {promotionFixture} from './owner-promotion-fixture';
import {handleWorkflow,type WorkflowServices,type WorkflowBucket} from '../functions/api/_workflow';
import {seedWorkflow} from '../src/workflow/seed';
import {WorkflowSyncError} from '../src/server/workflow/sync';
const pg=new PGlite(),files=new Map<string,{data:Uint8Array;mime:string}>();
let uncertainPut=false;
const db={query:async(sql:string,params?:unknown[])=>(await pg.query(sql,params)).rows as any[]};
const hash=async(v:string)=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))).toString('hex');
const bucket:WorkflowBucket={put:async(key,data,options)=>{files.set(key,{data,mime:options!.httpMetadata.contentType});if(uncertainPut)throw new WorkflowSyncError('Upload response lost.',503);},get:async key=>{const f=files.get(key);return f?{body:new Blob([f.data as Uint8Array<ArrayBuffer>]).stream(),size:f.data.length}:null;},delete:async key=>{files.delete(key);}};
const services:WorkflowServices={connect:()=>db,transact:()=>fn=>pg.transaction(tx=>fn({query:async(sql,params)=>(await tx.query(sql,params)).rows as any[]})),authenticate:async request=>{const token=request.headers.get('Cookie')?.split('=')[1];if(!token)return null;return(await db.query('SELECT u.* FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.session_token_hash=$1 AND s.expires_at>now()',[await hash(token)]))[0]||null;}};
const csrf=new Map<string,string>();
async function call(path:string,method='GET',body?:any,token='daniel',headers:Record<string,string>={}){return handleWorkflow({env:{DATABASE_URL:'isolated',WORKFLOW_MEDIA:bucket},request:new Request('https://tracker.test/api/workflow/'+path,{method,headers:{Cookie:'property_tracker_session='+token,'Content-Type':'application/json','X-Workflow-CSRF':csrf.get(token)||'',...headers},body:body===undefined?undefined:JSON.stringify(body)})},services);}
async function session(token='daniel'){const r=await call('session','GET',undefined,token);assert.equal(r.status,200,await r.clone().text());const s=await r.json();csrf.set(token,s.csrf);return s;}
async function switchTo(userId:number){const r=await call('switch','POST',{userId});assert.equal(r.status,200,await r.clone().text());}
try{
 await pg.exec("CREATE TABLE auth_users(id serial PRIMARY KEY,username text,display_name text,role text);CREATE TABLE auth_sessions(session_token_hash text UNIQUE,user_id int,expires_at timestamp);INSERT INTO auth_users VALUES(1,'admin','Daniel','super_admin'),(2,'Muz','Muz','admin'),(3,'Luqman','Luqman','admin'),(5,'drshahril74','Dr Shahril','admin'),(10,'Eypa','Eypa','admin'),(11,'observer','Observer','user')");
 await pg.exec(ownerListingsTableSql);await promotionFixture(pg);
 for(const name of ['0000_n8n_ingestion','0001_publication_channels','0005_owner_workflow','0006_owner_selangor_coverage','0007_owner_contacted_stage','0009_pause_owner_auto_assignment','0010_owner_summary_reports','0011_listing_report_creation','0012_marketing_workflow'])await pg.exec(readFileSync('drizzle/'+name+'.sql','utf8'));
 for(const [token,id] of [['daniel',1],['eypa',10],['muz',2],['observer',11],['other-daniel-session',1]] as const)await db.query("INSERT INTO auth_sessions VALUES($1,$2,now()+interval '1 day')",[await hash(token),id]);
 assert.equal((await call('session','GET',undefined,'missing')).status,401);
 const s=await session();assert.equal(s.actual.name,'Daniel');assert.equal(s.localPreview,false);
 await session('eypa');assert.equal((await call('switch','POST',{userId:1},'eypa')).status,403);
 assert.equal((await call('switch','POST',{userId:2},'daniel',{'X-Workflow-CSRF':'bad'})).status,403);
 assert.equal((await call('switch','POST',{userId:2},'daniel',{Origin:'https://evil.test'})).status,403);
 await switchTo(10);assert.equal((await session('other-daniel-session')).effective.id,1,'Switching stays in the original browser session');
 const brief={...seedWorkflow()[0].brief,reference:'WTS-202610-PRODUCTION-TEST',property:'Synthetic API property',sourceUrl:'',phone:'0190000001',permission:true,tasks:[]};
 let r=await call('listings','POST',{brief});assert.equal(r.status,201,await r.clone().text());let w=(await r.json()).listing;
 assert.deepEqual(w.assignees,{coordinator:10,producer:3,reviewer:5,publisher:2});
 assert.equal((await call(`listings/${w.id}/actions`,'POST',{version:w.version,productionWorker:true,action:{type:'productionWorker',operation:'claim',runId:'forged'}})).status,403);
 assert.equal((await call(`listings/${w.id}/actions`,'POST',{version:w.version,action:{type:'startProduction',provider:'template'}})).status,503);
 const action=async(a:any)=>{const r=await call(`listings/${w.id}/actions`,'POST',{version:w.version,action:a});assert.equal(r.status,200,await r.clone().text());w=(await r.json()).listing;};
 await action({type:'handoff'});await switchTo(3);
 assert.equal((await call(`listings/${w.id}/actions`,'POST',{version:w.version,action:{type:'addMaterial',kind:'photo',title:'Forged',fileKey:'not-owned.png'}})).status,400);
 await action({type:'addMaterial',kind:'copy',title:'Approved caption',text:'Approved copy',original:false});
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lLG+WAAAAABJRU5ErkJggg==','base64');
 const upload=async(version:number,mime='image/png',data:Uint8Array=png)=>handleWorkflow({env:{DATABASE_URL:'isolated',WORKFLOW_MEDIA:bucket},request:new Request(`https://tracker.test/api/workflow/listings/${w.id}/files?version=${version}&kind=photo&title=Exterior`,{method:'POST',headers:{Cookie:'property_tracker_session=daniel','X-Workflow-CSRF':csrf.get('daniel')!,'Content-Type':mime},body:data as Uint8Array<ArrayBuffer>})},services);
 r=await upload(w.version);assert.equal(r.status,200,await r.clone().text());w=(await r.json()).listing;assert.equal(files.size,1);
 uncertainPut=true;assert.equal((await upload(w.version)).status,503);assert.equal(files.size,1,'An accepted upload with a lost response must be cleaned up');uncertainPut=false;
 assert.equal((await upload(w.version-1)).status,409);assert.equal(files.size,1,'Failed upload removes only the new orphan');
 assert.equal((await upload(w.version,'image/png',new TextEncoder().encode('html'))).status,400);
 const file=w.materials.find((m:any)=>m.fileKey).fileKey;
 assert.equal((await call('files/'+file)).status,200);assert.equal((await call('files/'+file,'GET',undefined,'missing')).status,401);
 await action({type:'submit',ids:w.materials.map((m:any)=>m.id)});
 await switchTo(5);assert.equal((await call(`listings/${w.id}/actions`,'POST',{version:w.version,action:{type:'approveForPublishing',channelIds:['facebook-page'],materialIds:w.materials.map((m:any)=>m.id)}})).status,400,'Dr Shahril no longer performs the publishing handoff');
 await switchTo(2);await action({type:'approveForPublishing',channelIds:['facebook-page','tiktok','whatsapp-nhc'],materialIds:w.materials.map((m:any)=>m.id)});
 await switchTo(2);await action({type:'publish',channelId:'facebook-page',url:'https://example.com/published',note:'Published'});await action({type:'publish',channelId:'whatsapp-nhc',url:'',note:'Broadcast done'});
 assert.equal((await db.query('SELECT count(*)::int AS n FROM listing_publications WHERE listing_id=$1',[w.links.listingId]))[0].n,1);
 assert.ok((await db.query('SELECT notes FROM listings WHERE id=$1',[w.links.listingId]))[0].notes.includes('Broadcast HotListing Locality: Done'));
 await db.query("UPDATE owner_listings SET status='Unlisted' WHERE id=$1",[w.links.ownerId]);
 await switchTo(2);assert.equal((await call(`listings/${w.id}/actions`,'POST',{version:w.version,action:{type:'approveForPublishing',channelIds:['facebook-page','tiktok','whatsapp-nhc','mudah'],materialIds:w.materials.map((m:any)=>m.id)}})).status,409);
 await db.query("UPDATE auth_users SET role='user' WHERE id=1");assert.equal((await session()).effective.id,1,'Revoked SuperAdmin cannot keep impersonating');assert.equal((await call('switch','POST',{userId:10})).status,403);
 await db.query('DELETE FROM auth_sessions WHERE session_token_hash=$1',[await hash('daniel')]);assert.equal((await call('listings')).status,401,'Logout invalidates workflow access');
 console.log('PASS production workflow auth, scoped switching, real account assignments, CSRF, private uploads, orphan cleanup, linked publications and revocation');
}finally{await pg.close();}
