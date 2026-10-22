import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LocalWorkflowStore} from '../src/server/workflow/store';
import {createWorkflowRouter} from '../src/server/workflow/router';
import {previewUsers} from '../src/workflow/seed';
const dir=await mkdtemp(join(tmpdir(),'workflow-test-'));
const store=new LocalWorkflowStore(dir);await store.init();
const app=express();app.use('/api/workflow',createWorkflowRouter(store,async()=>previewUsers[0]));
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${(server.address() as any).port}/api/workflow`;
let cookie='',csrf='';
async function req(path:string,body?:unknown,headers:Record<string,string>={}){return fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,'X-Workflow-CSRF':csrf,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});}
try{
  assert.equal((await req('/listings')).status,401);
  const session=await req('/session');cookie=session.headers.get('set-cookie')!.split(';')[0];csrf=(await session.json()).csrf;
  assert.equal((await req('/switch',{userId:2},{'X-Workflow-CSRF':''})).status,403);
  assert.equal((await req('/switch',{userId:2})).status,200);
  let w=(await (await req('/listings')).json()).listings[0];
  assert.equal((await req(`/listings/${w.id}/actions`,{version:w.version,action:{type:'productionWorker',operation:'claim',runId:'forged'},productionWorker:true})).status,403);
  assert.equal((await req(`/listings/${w.id}/actions`,{version:w.version,action:{type:'startProduction',provider:'template'}})).status,503);
  assert.equal((await req(`/listings/${w.id}/actions`,{version:w.version,action:{type:'handoff'}})).status,200);
  assert.equal((await req(`/listings/${w.id}/actions`,{version:w.version,action:{type:'handoff'}})).status,409);
  w=(await (await req('/listings')).json()).listings[0];
  assert.equal((await req(`/listings/${w.id}/actions`,{version:w.version,action:{type:'addDestination',channelId:'tiktok'},actual:{role:'super_admin'}})).status,400);
  assert.equal((await req('/switch',{userId:3})).status,200);
  assert.equal((await req(`/listings/${w.id}/actions`,{version:w.version,action:{type:'addMaterial',kind:'photo',fileKey:'../../secret.env',title:'Forged file'}})).status,400);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lLG+WAAAAABJRU5ErkJggg==','base64');
  async function upload(buffer:Buffer,mime:string){return fetch(`${base}/listings/${w.id}/files?version=${w.version}&kind=photo&title=Test%20photo`,{method:'POST',headers:{Cookie:cookie,'X-Workflow-CSRF':csrf,'Content-Type':mime},body:buffer});}
  assert.equal((await upload(Buffer.from('<script>bad</script>'),'image/png')).status,400);
  const uploaded=await upload(png,'image/png');assert.equal(uploaded.status,200,await uploaded.clone().text());w=(await uploaded.json()).listing;
  const asset=w.materials.at(-1);assert.ok(asset.fileKey);
  assert.equal((await fetch(`${base}/files/${asset.fileKey}`)).status,401);
  assert.equal((await req(`/files/${asset.fileKey}`)).status,200);
  const reopened=new LocalWorkflowStore(dir);await reopened.init();assert.equal(reopened.list()[0].materials.at(-1)!.fileKey,asset.fileKey);
  const ownSession=await fetch(base+'/session');const ownCookie=ownSession.headers.get('set-cookie')!.split(';')[0];const own=await fetch(base+'/session',{headers:{Cookie:ownCookie}});assert.equal((await own.json()).effective.id,1,'Sessions must not share acting users');
  await req('/switch',{userId:1});assert.equal((await (await req('/session')).json()).effective.name,'Daniel');
  const ordinaryApp=express();ordinaryApp.use('/api/workflow',createWorkflowRouter(store,async()=>previewUsers[4]));
  const ordinaryServer=ordinaryApp.listen(0,'127.0.0.1');await new Promise<void>(resolve=>ordinaryServer.once('listening',resolve));
  try{
    const ordinaryBase=`http://127.0.0.1:${(ordinaryServer.address() as any).port}/api/workflow`;
    const response=await fetch(ordinaryBase+'/session'),ordinaryCookie=response.headers.get('set-cookie')!.split(';')[0],ordinarySession=await response.json();
    const switched=await fetch(ordinaryBase+'/switch',{method:'POST',headers:{Cookie:ordinaryCookie,'Content-Type':'application/json','X-Workflow-CSRF':ordinarySession.csrf},body:JSON.stringify({userId:1,actual:{role:'super_admin'}})});
    assert.equal(switched.status,403,'An ordinary signed-in user cannot become Daniel by supplying an actor in the request');
  }finally{await new Promise<void>(resolve=>ordinaryServer.close(()=>resolve()));}
  console.log('PASS workflow HTTP authentication, session isolation, CSRF, stale writes, role enforcement, upload validation and persistence');
}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});}
