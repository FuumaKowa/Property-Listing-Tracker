import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {neonWorkflowBucket} from '../src/server/workflow/neon-storage';
const config={endpoint:'https://br-test.storage.c-4.ap-southeast-1.aws.neon.tech',region:'ap-southeast-1',bucket:'listing-workflow-media',accessKeyId:'test-access',secretAccessKey:'test-secret'};
assert.equal(neonWorkflowBucket(),undefined);
const bucket=neonWorkflowBucket(JSON.stringify(config));assert.ok(bucket,'Neon credentials must enable private workflow storage');
const originalFetch=globalThis.fetch,requests:Request[]=[];let status=200;
globalThis.fetch=async(input:any,init?:RequestInit)=>{
 const r=new Request(input,init);requests.push(r);
 if(r.method==='GET'){
  if(status===404)return new Response('<Error><Code>NoSuchKey</Code></Error>',{status:404,headers:{'Content-Type':'application/xml'}});
  if(status===403)return new Response('<Error><Code>AccessDenied</Code><Message>secret provider detail</Message></Error>',{status:403,headers:{'Content-Type':'application/xml'}});
  if(status===416)return new Response('<Error><Code>InvalidRange</Code></Error>',{status:416,headers:{'Content-Type':'application/xml'}});
  return r.headers.has('range')?new Response(new Uint8Array([2,3]),{status:206,headers:{'Content-Range':'bytes 1-2/4','Content-Length':'2','Content-Type':'image/png'}}):new Response(new Uint8Array([1,2,3,4]),{headers:{'Content-Length':'4','Content-Type':'image/png'}});
 }
 return new Response(null,{status:200});
};
try{
 await bucket.put('workflow-id/photo name.png',new Uint8Array([1,2,3,4]),{httpMetadata:{contentType:'image/png'}});
 assert.equal(new URL(requests[0].url).pathname,'/listing-workflow-media/workflow-id/photo%20name.png');
 assert.ok(requests[0].headers.get('authorization')?.startsWith('AWS4-HMAC-SHA256'));
 assert.equal(requests[0].headers.get('content-type'),'image/png');
 const full=await bucket.get('workflow-id/photo name.png');assert.equal(full?.size,4);assert.deepEqual([...new Uint8Array(await new Response(full!.body).arrayBuffer())],[1,2,3,4]);
 const partial=await bucket.get('workflow-id/photo name.png',{range:new Headers({Range:'bytes=1-2'})});assert.deepEqual(partial?.range,{offset:1,length:2});assert.equal(partial?.size,4);
 status=404;assert.equal(await bucket.get('missing'),null);
 status=403;await assert.rejects(()=>bucket.get('denied'),e=>(e as any).status===503&&!String(e).includes('secret provider detail'));
 status=416;await assert.rejects(()=>bucket.get('range'),e=>(e as any).status===416);
 await bucket.delete('workflow-id/photo name.png');assert.equal(requests.at(-1)?.method,'DELETE');
 assert.throws(()=>neonWorkflowBucket('{invalid'),/storage configuration/i);
 assert.throws(()=>neonWorkflowBucket(JSON.stringify({...config,endpoint:'http://example.com'})),/storage configuration/i);
 let started!:()=>void,transfer:Request|undefined;const ready=new Promise<void>(r=>started=r);
 globalThis.fetch=async(input:any,init?:RequestInit)=>{transfer=new Request(input,init);started();return new Promise<Response>((_,reject)=>transfer!.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));};
 mock.timers.enable({apis:['setTimeout']});
 try{const pending=bucket.put('timeout.png',new Uint8Array([1]));const rejected=assert.rejects(()=>pending,e=>(e as any).status===503);await ready;mock.timers.tick(30001);await rejected;assert.equal(transfer?.signal.aborted,true,'Timeout must abort the upload before cleanup starts');}finally{mock.timers.reset();}
 console.log('PASS Neon storage signed path-style upload, private download, video ranges, missing files, safe errors and cleanup');
}finally{globalThis.fetch=originalFetch;}
