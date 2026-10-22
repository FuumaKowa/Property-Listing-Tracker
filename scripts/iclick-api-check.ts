import assert from 'node:assert/strict';
import {handleIclick,type IclickServices} from '../functions/api/_iclick';

const approvedPhoto={id:'photo-1',kind:'photo',title:'Exterior',revision:1,original:false,fileKey:'123e4567-e89b-42d3-a456-426614174000.jpg',mime:'image/jpeg',review:'approved',note:'',at:'2026-10-20T00:00:00Z',by:'Producer'};
const archivedPhoto={...approvedPhoto,id:'removed-photo',title:'Removed photo',fileKey:'123e4567-e89b-42d3-a456-426614174002.jpg',archivedAt:'2026-10-22T00:00:00Z'};
const workflow={id:'e89b2f29-a1ce-4d3b-b845-19a61a82f964',brief:{reference:'WTS-202610-00008',details:'3 bedrooms\nLeasehold'},materials:[{id:'copy-1',kind:'copy',title:'Ad copy',text:'FOR SALE | Laman Seri',review:'approved',original:false,at:'2026-10-20T00:00:00Z'},approvedPhoto,archivedPhoto]};
const uploadedPhoto={id:91,listingId:8,fileKey:'123e4567-e89b-42d3-a456-426614174001.png',objectKey:'iclick/8/123e4567-e89b-42d3-a456-426614174001.png',title:'Kitchen',contentType:'image/png',createdAt:'2026-10-21T00:00:00Z'};
const db={async query(sql:string,params:unknown[]=[]){
 if(sql.includes('FROM listings l'))return [{id:8,property:'Laman Seri',projectCategory:'Subsale Direct Listing (SSDL)',location:'Shah Alam',tenure:'Leasehold',availableUnits:'1',askingPrice:'1550000.00',status:'Active',agent:'Listing Agent',negotiator:'NHC',noTel:'012-1112222',reference:'WTS-202610-00008',workflowData:workflow},{id:9,property:'Incomplete Listing',projectCategory:'Rental',location:'Sepang',askingPrice:null,status:'Active',workflowData:null}];
 if(sql.includes('FROM marketing_workflows')&&/l\.id\s*=\s*\$1/.test(sql))return [{data:workflow}];
 if(sql.includes('FROM iclick_listing_images i JOIN listings'))return params[1]===uploadedPhoto.fileKey?[uploadedPhoto]:[];
 if(sql.includes('FROM iclick_listing_images WHERE listing_id=ANY'))return [uploadedPhoto];
 return [];
}};
const files=new Map([[`${workflow.id}/${approvedPhoto.fileKey}`,new Uint8Array([1,2,3])],[uploadedPhoto.objectKey,new Uint8Array([4,5,6,7])]]);
const bucket={put:async()=>{},delete:async()=>{},get:async(key:string)=>{const data=files.get(key);return data?{body:new Blob([data as Uint8Array<ArrayBuffer>]).stream(),size:data.length,httpMetadata:{contentType:'image/jpeg'}}:null;}};
const services:IclickServices={connect:()=>db,media:()=>bucket};
const env={DATABASE_URL:'isolated',ICLICK_API_TOKEN:'test-token'};
async function call(path:string,token?:string,method='GET'){
 return handleIclick({env,request:new Request(`https://tracker.test${path}`,{method,headers:token?{Authorization:`Bearer ${token}`}:{}})},services);
}
const denied=await call('/api/v1/iclick/listings');assert.equal(denied.status,401,'API rejects missing bearer token');
const wrong=await call('/api/v1/iclick/listings','wrong');assert.equal(wrong.status,401,'API rejects incorrect bearer token');
const ok=await call('/api/v1/iclick/listings','test-token');assert.equal(ok.status,200);
const feed=await ok.json() as any;assert.equal(feed.data[0].reference,'WTS-202610-00008');assert.equal(feed.data[0].askingPrice,1550000);assert.equal(feed.data[0].publishReady,true);assert.equal(feed.data[0].copywriting,'FOR SALE | Laman Seri');assert.equal(feed.data[0].images.length,2);assert.match(feed.data[0].images[0].url,/\/api\/v1\/iclick\/listings\/8\/images\//);assert.equal(feed.data[1].askingPrice,null);assert.equal(feed.data[1].publishReady,false);assert.deepEqual(feed.data[1].missing,['numeric_price','approved_copywriting','approved_image']);
const imagePath=new URL(feed.data[0].images.find((image:any)=>image.contentType==='image/jpeg').url).pathname;
const image=await call(imagePath,'test-token');assert.equal(image.status,200,await image.clone().text());assert.equal(image.headers.get('Content-Type'),'image/jpeg');assert.equal((await image.arrayBuffer()).byteLength,3);
const uploadedPath=new URL(feed.data[0].images.find((image:any)=>image.title==='Kitchen').url).pathname;
const uploaded=await call(uploadedPath,'test-token');assert.equal(uploaded.status,200);assert.equal(uploaded.headers.get('Content-Type'),'image/png');assert.equal((await uploaded.arrayBuffer()).byteLength,4,'IClick workspace uploads stream from the same partner API');
const archivedPath=`/api/v1/iclick/listings/8/images/${archivedPhoto.fileKey}`;assert.equal((await call(archivedPath,'test-token')).status,404,'Removed workflow images must not be exposed to IClick');
const missingTokenEnv={DATABASE_URL:'isolated'};
const unavailable=await handleIclick({env:missingTokenEnv,request:new Request('https://tracker.test/api/v1/iclick/listings',{headers:{Authorization:'Bearer test-token'}})},services);assert.equal(unavailable.status,503,'API fails closed until a secret is configured');
const wrongMethod=await call('/api/v1/iclick/listings','test-token','POST');assert.equal(wrongMethod.status,405);
console.log('IClick API authentication, listing serialization, publish readiness and private image streaming checks passed.');
