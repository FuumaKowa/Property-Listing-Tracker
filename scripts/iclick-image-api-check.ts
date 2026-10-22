import assert from 'node:assert/strict';
import {handleIclickWorkspace,type IclickWorkspaceServices} from '../functions/api/_iclick-workspace';
const imageKey='123e4567-e89b-42d3-a456-426614174000.png';
const record={id:7,listingId:8,fileKey:imageKey,objectKey:`iclick/8/${imageKey}`,title:'Kitchen',contentType:'image/png',byteSize:8,createdByName:'Tester',createdAt:'2026-10-21T00:00:00.000Z'};
let failInsert=false;const objects=new Map<string,Uint8Array>([[record.objectKey,new Uint8Array([137,80,78,71,13,10,26,10])]]);let receivedSql:string[]=[];let inserted:any=null;
const db={async query(sql:string,params:unknown[]=[]){receivedSql.push(sql);
 if(sql.includes('FROM listings l')&&sql.includes('LEFT JOIN marketing_workflows'))return [{id:8,property:'Laman Seri',projectCategory:'Subsale Direct Listing (SSDL)',location:'Shah Alam',askingPrice:'1550000.00',status:'Active',version:3,reference:'WTS-202610-00008',copywriting:'Verified ad copy'}];
 if(sql.includes('FROM listings WHERE id=$1'))return [{id:8,version:3}];
 if(sql.includes('FROM iclick_listing_images')&&sql.startsWith('SELECT'))return [inserted||record];
 if(sql.startsWith('INSERT INTO iclick_listing_images')){if(failInsert)throw new Error('database unavailable');inserted={...record,listingId:Number(params[0]),fileKey:params[1],objectKey:params[2],title:params[3],contentType:params[4],byteSize:params[5]};return [inserted];}
 if(sql.startsWith('DELETE FROM iclick_listing_images'))return [record];
 return [];
}};
const media={put:async(key:string,data:Uint8Array)=>{objects.set(key,data);},get:async(key:string)=>{const data=objects.get(key);return data?{body:new Blob([data as Uint8Array<ArrayBuffer>]).stream(),size:data.length,httpMetadata:{contentType:'image/png'}}:null;},delete:async(key:string)=>{objects.delete(key);}};
const services:IclickWorkspaceServices={authenticate:async request=>request.headers.get('Cookie')==='session=ok'?{id:3,username:'tester',displayName:'Tester'} as any:null,connect:()=>db,media:()=>media};
const env={DATABASE_URL:'isolated'};
async function call(path:string,method='GET',body?:BodyInit,headers:Record<string,string>={'Cookie':'session=ok'}){return handleIclickWorkspace({env,request:new Request(`https://tracker.test/api/iclick-workspace/${path}`,{method,headers,body})},services);}
assert.equal((await call('listings','GET',undefined,{})).status,401,'Workspace requires a signed-in user');
const rows=await call('listings');assert.equal(rows.status,200);const payload=await rows.json() as any;assert.equal(payload.data[0].id,8);assert.equal(payload.data[0].images.length,1);assert.match(receivedSql[0],/l\.status\s*=\s*'Active'/);assert.match(receivedSql[0],/l\.archived_at\s+IS\s+NULL/);assert.doesNotMatch(receivedSql.join(' '),/owner_listings/);
const png=Uint8Array.from([137,80,78,71,13,10,26,10]);
assert.equal((await call('listings/8/images','POST',Buffer.from('not image'),{'Cookie':'session=ok','Content-Type':'image/png'})).status,400,'MIME must match real image bytes');
const uploaded=await call('listings/8/images','POST',png,{'Cookie':'session=ok','Content-Type':'image/png','X-File-Name':'Kitchen'});assert.equal(uploaded.status,201);const uploadedData=await uploaded.json() as any;const uploadedKey=uploadedData.data.fileKey;assert.ok(objects.has(`iclick/8/${uploadedKey}`));
const fetched=await call(`listings/8/images/${uploadedKey}`);assert.equal(fetched.status,200);assert.equal((await fetched.arrayBuffer()).byteLength,8);
assert.equal((await call(`listings/8/images/${uploadedKey}`,'GET',undefined,{})).status,401);
assert.equal((await call(`listings/8/images/${uploadedKey}`,'DELETE',undefined,{'Cookie':'session=ok','Origin':'https://attacker.test'})).status,403,'Workspace mutations reject cross-origin requests');
assert.equal((await call(`listings/8/images/${uploadedKey}`,'DELETE')).status,200);assert.equal(objects.size,1,'Pre-existing listing image remains untouched');
failInsert=true;const orphan=await call('listings/8/images','POST',png,{'Cookie':'session=ok','Content-Type':'image/png','X-File-Name':'Kitchen'});assert.equal(orphan.status,500);assert.equal(objects.size,1,'Metadata failure removes the just-uploaded object but preserves existing images');
console.log('PASS IClick workspace auth, active category listing isolation, private image upload/stream/delete and failure cleanup');
