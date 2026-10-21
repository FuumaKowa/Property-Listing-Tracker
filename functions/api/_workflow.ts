import {Pool} from '@neondatabase/serverless';
import {getSessionUser,type AuthEnv,type AuthUser} from './_auth';
import {getDb} from './_db';
import {DatabaseWorkflowStore,type WorkflowDb,type WorkflowTransaction} from '../../src/server/workflow/database';
import {WorkflowSyncError} from '../../src/server/workflow/sync';
import {neonWorkflowBucket} from '../../src/server/workflow/neon-storage';
import {workflowChannels,type WorkflowUser,type WorkflowContext} from '../../src/workflow/model';
export interface WorkflowBucket {
 put(key:string,value:Uint8Array,options?:{httpMetadata:{contentType:string}}):Promise<unknown>;
 get(key:string,options?:{range:Headers}):Promise<{body:ReadableStream;size:number;httpMetadata?:{contentType?:string};range?:{offset:number;length:number}}|null>;
 delete(key:string):Promise<unknown>;
}
export interface WorkflowEnv extends AuthEnv {NEON_STORAGE_CONFIG?:string;WORKFLOW_MEDIA?:WorkflowBucket;WORKFLOW_PRODUCTION_ENABLED?:string;WORKFLOW_OPENAI_READY?:string}
export interface WorkflowServices {authenticate:(request:Request,env:AuthEnv)=>Promise<AuthUser|null>;connect:(env:AuthEnv)=>WorkflowDb;transact:(env:AuthEnv)=>WorkflowTransaction}
const production:WorkflowServices={authenticate:getSessionUser,connect:getDb,transact:env=>async fn=>{
 const pool=new Pool({connectionString:env.DATABASE_URL});
 try{const client=await pool.connect();try{await client.query('BEGIN');const result=await fn({query:async(sql,params)=>(await client.query(sql,params)).rows});await client.query('COMMIT');return result;}
 catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
 finally{client.release();}}
 finally{await pool.end();}
}};
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
async function body(request:Request,max:number){
 if(Number(request.headers.get('content-length'))>max)throw new WorkflowSyncError('The upload or request is too large.',413);
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const item=await reader.read();if(item.done)break;length+=item.value.length;if(length>max){await reader.cancel();throw new WorkflowSyncError('The upload or request is too large.',413);}chunks.push(item.value);}}finally{reader.releaseLock();}
 const data=new Uint8Array(length);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}return data;
}
function fileExtension(data:Uint8Array,mime:string){
 const starts=(a:number[])=>a.every((v,i)=>data[i]===v),ascii=(a:number,b:number)=>new TextDecoder().decode(data.subarray(a,b));
 if(mime==='image/png'&&starts([137,80,78,71,13,10,26,10]))return 'png';
 if(mime==='image/jpeg'&&starts([255,216,255]))return 'jpg';
 if(mime==='image/webp'&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP')return 'webp';
 if(mime==='video/mp4'&&ascii(4,8)==='ftyp')return 'mp4';
 if(mime==='video/webm'&&starts([26,69,223,163]))return 'webm';
 throw new WorkflowSyncError('Upload a valid JPEG, PNG, WebP, MP4 or WebM file up to 30 MB.',400);
}
export async function handleWorkflow({request,env}:{request:Request;env:WorkflowEnv},services:WorkflowServices=production):Promise<Response>{
 try{
  const actualAccount=await services.authenticate(request,env);if(!actualAccount)return response({error:'Sign in to open the marketing workflow.'},401);
  const db=services.connect(env),url=new URL(request.url),route=url.pathname.replace(/^\/api\/workflow\/?/,'');
  const media=env.WORKFLOW_MEDIA||neonWorkflowBucket(env.NEON_STORAGE_CONFIG);
  const roster=await db.query("SELECT u.id,coalesce(nullif(u.display_name,''),u.username) AS name,CASE WHEN u.role='super_admin' THEN 'super_admin' ELSE coalesce(r.role,'viewer') END AS role FROM auth_users u LEFT JOIN marketing_workflow_roles r ON r.user_id=u.id ORDER BY u.id") as WorkflowUser[];
  const actual=roster.find(u=>u.id===actualAccount.id);if(!actual)return response({error:'Your account is no longer available.'},401);
  const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)property_tracker_session=([^;]+)/)?.[1];if(!token)return response({error:'Sign in again to continue.'},401);
  const sessionHash=await hash(token);
  if(route==='session'&&request.method==='GET')await db.query('INSERT INTO marketing_workflow_sessions(session_hash,effective_user_id,csrf) VALUES($1,$2,$3) ON CONFLICT(session_hash) DO NOTHING',[sessionHash,actual.id,crypto.randomUUID()+crypto.randomUUID()]);
  const saved=(await db.query('SELECT * FROM marketing_workflow_sessions WHERE session_hash=$1',[sessionHash]))[0];
  if(!saved)return response({error:'Refresh the workflow to initialize your session.'},401);
  let effective=actual.role==='super_admin'?roster.find(u=>u.id===saved.effective_user_id)||actual:actual;
  const payload=()=>({actual,effective,csrf:saved.csrf,users:actual.role==='super_admin'?roster:[],localPreview:false,storageReady:!!media,production:{enabled:env.WORKFLOW_PRODUCTION_ENABLED==='true',openaiReady:env.WORKFLOW_OPENAI_READY==='true'}});
  if(request.method!=='GET'){
   if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return response({error:'Use the tracker from the same browser origin.'},403);
   if(request.headers.get('X-Workflow-CSRF')!==saved.csrf)return response({error:'Refresh the workflow before saving.'},403);
  }
  const context:WorkflowContext={actual,effective},store=new DatabaseWorkflowStore(db,services.transact(env),roster);
  if(route==='session'&&request.method==='GET')return response(payload());
  if(route==='listings'&&request.method==='GET')return response({listings:await store.list(),channels:workflowChannels});
  if(route==='listing-link'&&request.method==='GET'){
   const id=Number(url.searchParams.get('listingId')),ownerId=Number(url.searchParams.get('ownerId'));
   if(!Number.isSafeInteger(id)||!Number.isSafeInteger(ownerId)||id<0||ownerId<0)return response({error:'Invalid listing ID.'},400);
   return response({listing:(await db.query('SELECT data FROM marketing_workflows WHERE listing_id=$1 OR owner_listing_id=$2',[id||null,ownerId||null]))[0]?.data||null});
  }
  const file=/^files\/([a-f0-9-]{36}\.(?:jpg|png|webp|mp4|webm))$/.exec(route);
  if(file&&request.method==='GET'){
   const row=(await db.query("SELECT data FROM marketing_workflows WHERE data->'materials' @> $1::jsonb LIMIT 1",[JSON.stringify([{fileKey:file[1]}])]))[0];
   const material=row?.data.materials.find((m:any)=>m.fileKey===file[1]);if(!material)return response({error:'File not found.'},404);
   if(!media)return response({error:'Media storage is unavailable.'},503);
   const object=await media.get(`${row.data.id}/${file[1]}`,{range:request.headers});if(!object)return response({error:'File not found.'},404);
   const headers=new Headers({'Content-Type':material.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Content-Disposition':`${url.searchParams.has('download')?'attachment':'inline'}; filename="${file[1]}"`});
   if(object.range){headers.set('Content-Range',`bytes ${object.range.offset}-${object.range.offset+object.range.length-1}/${object.size}`);headers.set('Content-Length',String(object.range.length));}else headers.set('Content-Length',String(object.size));
   return new Response(object.body,{status:object.range?206:200,headers});
  }
  const upload=/^listings\/([a-f0-9-]{36})\/files$/.exec(route);
  if(upload&&request.method==='POST'){
   if(!media)return response({error:'Media storage is unavailable. Your other details are saved.'},503);
   const data=await body(request,30*1024*1024),mime=request.headers.get('Content-Type')?.split(';')[0]||'',extension=fileExtension(data,mime),kind=url.searchParams.get('kind') as 'photo'|'poster'|'video';
   if(!['photo','poster','video'].includes(kind)||(kind==='video')!==mime.startsWith('video/'))return response({error:'Choose the matching material type.'},400);
   const key=crypto.randomUUID()+'.'+extension,objectKey=`${upload[1]}/${key}`;
   try{await media.put(objectKey,data,{httpMetadata:{contentType:mime}});return response({listing:await store.action(upload[1],Number(url.searchParams.get('version')),{type:'addMaterial',kind,title:url.searchParams.get('title')||'Uploaded material',fileKey:key,mime,original:url.searchParams.get('original')==='true',replacesId:url.searchParams.get('replacesId')||undefined},context)});}
   catch(error){await media.delete(objectKey).catch(()=>{});throw error;}
  }
  if(request.method!=='POST')return response({error:'Workflow route not found.'},404);
  let input:any;try{input=JSON.parse(new TextDecoder().decode(await body(request,256000)));}catch(error){if(error instanceof WorkflowSyncError)throw error;return response({error:'Invalid workflow request.'},400);}
  if(route==='switch'){
   if(actual.role!=='super_admin')return response({error:'Only the signed-in SuperAdmin can switch workflow users.'},403);
   const target=roster.find(u=>u.id===input?.userId);if(!target)return response({error:'Choose an existing user.'},400);
   await services.transact(env)(async tx=>{await tx.query('UPDATE marketing_workflow_sessions SET effective_user_id=$2,updated_at=now() WHERE session_hash=$1',[sessionHash,target.id]);await tx.query('INSERT INTO marketing_workflow_switches(actual_user_id,actual_name,from_name,to_name) VALUES($1,$2,$3,$4)',[actual.id,actual.name,effective.name,target.name]);});
   effective=target;return response(payload());
  }
  if(route==='listings')return response({listing:await store.create(input?.brief,context,input?.links||{})},201);
  const mutation=/^listings\/([a-f0-9-]{36})\/actions$/.exec(route);
  if(mutation){
   if(input?.action?.type==='productionWorker')return response({error:'Only the production worker can update job results.'},403);
   if(input?.action?.type==='startProduction'&&(env.WORKFLOW_PRODUCTION_ENABLED!=='true'||(input.action.provider==='openai'&&env.WORKFLOW_OPENAI_READY!=='true')))return response({error:env.WORKFLOW_PRODUCTION_ENABLED!=='true'?'Automatic production worker is not connected.':'Connect an OpenAI API key or choose Templates.'},503);
   const action=input?.action;if(action?.type==='addMaterial'&&(action.kind!=='copy'||action.fileKey||action.mime))return response({error:'Use file upload for photos, posters and video.'},400);
   return response({listing:await store.action(mutation[1],input?.version,action,context)});
  }
  return response({error:'Workflow route not found.'},404);
 }catch(error:any){
  if(error instanceof WorkflowSyncError)return response({error:error.message,...error.details},error.status);
  if(['23505','55P03','40001','40P01'].includes(error?.code))return response({error:'A matching record changed. Refresh and review the existing listing before saving.'},409);
  if(error?.code)return response({error:'Unable to save the workflow. All linked record changes were rolled back.'},500);
  return response({error:error instanceof Error?error.message:'Unable to save this workflow.'},400);
 }
}
