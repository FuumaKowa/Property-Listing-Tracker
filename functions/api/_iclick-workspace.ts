import {getDb,json} from './_db';
import {getSessionUser,type AuthEnv,type AuthUser} from './_auth';
import {neonWorkflowBucket} from '../../src/server/workflow/neon-storage';
import type {WorkflowBucket} from './_workflow';
export interface IclickWorkspaceEnv extends AuthEnv {NEON_STORAGE_CONFIG?:string;ICLICK_MEDIA?:WorkflowBucket}
interface WorkspaceDb {query:(sql:string,params?:unknown[])=>Promise<any[]>}
export interface IclickWorkspaceServices {authenticate:(request:Request,env:AuthEnv)=>Promise<AuthUser|null>;connect:(env:AuthEnv)=>WorkspaceDb;media:(env:IclickWorkspaceEnv)=>WorkflowBucket|undefined}
const production:IclickWorkspaceServices={authenticate:getSessionUser,connect:getDb,media:env=>env.ICLICK_MEDIA||neonWorkflowBucket(env.NEON_STORAGE_CONFIG)};
const fail=(error:string,status:number)=>json({success:false,error},status);
const maxBytes=15*1024*1024;
const keyPattern=/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/i;
function imageExtension(data:Uint8Array,mime:string){
 const starts=(bytes:number[])=>bytes.every((byte,index)=>data[index]===byte);
 const ascii=(start:number,end:number)=>new TextDecoder().decode(data.subarray(start,end));
 if(mime==='image/png'&&starts([137,80,78,71,13,10,26,10]))return 'png';
 if(mime==='image/jpeg'&&starts([255,216,255]))return 'jpg';
 if(mime==='image/webp'&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP')return 'webp';
 throw Object.assign(new Error('Upload a valid JPEG, PNG or WebP image.'),{status:400});
}
async function readBody(request:Request){
 if(Number(request.headers.get('content-length'))>maxBytes)throw Object.assign(new Error('Images must be 15 MB or smaller.'),{status:413});
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>maxBytes){await reader.cancel();throw Object.assign(new Error('Images must be 15 MB or smaller.'),{status:413});}chunks.push(item.value);}}finally{reader.releaseLock();}
 const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}return data;
}
function route(request:Request){return new URL(request.url).pathname.replace(/^\/api\/iclick-workspace\/?/,'');}
async function activeListing(db:WorkspaceDb,id:string){
 if(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))return null;
 return (await db.query("SELECT id,version FROM listings WHERE id=$1 AND status='Active' AND archived_at IS NULL",[Number(id)]))[0]||null;
}
export async function handleIclickWorkspace({request,env}:{request:Request;env:IclickWorkspaceEnv},services:IclickWorkspaceServices=production):Promise<Response>{
 try{
  if(['POST','PATCH','PUT','DELETE'].includes(request.method)){
   const origin=request.headers.get('Origin');
   if(origin&&origin!==new URL(request.url).origin)return fail('Cross-origin requests are not allowed.',403);
  }
  const user=await services.authenticate(request,env);if(!user)return fail('Sign in to edit IClick listings.',401);
  const db=services.connect(env),path=route(request),match=path.match(/^listings\/([1-9]\d*)(?:\/images(?:\/([a-f0-9-]{36}\.(?:jpg|png|webp)))?)?$/i);
  if(path==='listings'&&request.method==='GET'){
   const url=new URL(request.url),rawLimit=Number(url.searchParams.get('limit')||50),limit=Number.isSafeInteger(rawLimit)?Math.min(100,Math.max(1,rawLimit)):50,cursorRaw=url.searchParams.get('cursor'),cursor=cursorRaw===null?0:Number(cursorRaw),query=(url.searchParams.get('q')||'').trim().slice(0,120),category=url.searchParams.get('category')||'all',completeness=url.searchParams.get('completeness')||'all';
   if(!Number.isSafeInteger(cursor)||cursor<0)return fail('cursor must be a non-negative listing ID.',400);
   if(!['all','rental','subsale'].includes(category)||!['all','incomplete','ready'].includes(completeness))return fail('Invalid listing filter.',400);
   const rows=await db.query(`SELECT l.id,l.version,l.property,l.project_category AS "projectCategory",l.location,l.tenure,l.available_units AS "availableUnits",l.asking_price::text AS "askingPrice",l.status,l.archived_at AS "archivedAt",
     (SELECT r.reference FROM listing_report_references r WHERE r.listing_id=l.id ORDER BY r.created_at DESC LIMIT 1) AS reference,w.data AS "workflowData"
     FROM listings l LEFT JOIN marketing_workflows w ON w.listing_id=l.id
     WHERE l.status='Active' AND l.archived_at IS NULL AND l.id>$1
       AND l.project_category IN ('Rental','Subsale Direct Listing (SSDL)','Subsale Direct Listing')
       AND ($2='' OR concat_ws(' ',l.property,l.location,(SELECT r.reference FROM listing_report_references r WHERE r.listing_id=l.id ORDER BY r.created_at DESC LIMIT 1)) ILIKE '%'||$2||'%')
       AND ($3='all' OR ($3='rental' AND l.project_category='Rental') OR ($3='subsale' AND l.project_category<>'Rental'))
     ORDER BY l.id LIMIT $4`,[cursor,query,category,limit+1]);
   const hasMore=rows.length>limit,items=rows.slice(0,limit);
   const ids=items.map((row:any)=>Number(row.id));
   const photos=ids.length?await db.query('SELECT id,listing_id AS "listingId",file_key AS "fileKey",title,content_type AS "contentType",byte_size AS "byteSize",created_at AS "createdAt" FROM iclick_listing_images WHERE listing_id=ANY($1::int[]) ORDER BY id',[ids]):[];
   const data=items.map((row:any)=>{
    const workflow=row.workflowData,materials=Array.isArray(workflow?.materials)?workflow.materials.filter((item:any)=>item&&!item.replacedBy&&!item.archivedAt&&!item.original&&item.review==='approved'):[];
    const copy=[...materials].filter((item:any)=>item.kind==='copy'&&typeof item.text==='string'&&item.text.trim()).sort((a:any,b:any)=>String(b.at||'').localeCompare(String(a.at||'')))[0];
    const images=photos.filter((image:any)=>Number(image.listingId)===Number(row.id)).map((image:any)=>({...image,url:new URL(`/api/iclick-workspace/listings/${row.id}/images/${image.fileKey}`,request.url).toString()}));
    return {id:Number(row.id),version:Number(row.version),reference:workflow?.brief?.reference||row.reference||null,property:row.property,category:row.projectCategory,location:row.location,tenure:row.tenure||null,availableUnits:row.availableUnits||null,askingPrice:row.askingPrice===null?null:Number(row.askingPrice),copywriting:copy?.text||null,images};
   });
   const filtered=data.filter((row:any)=>completeness==='all'||(completeness==='ready'?row.askingPrice!==null&&!!row.copywriting&&row.images.length>0:row.askingPrice===null||!row.copywriting||row.images.length===0));
   return json({success:true,data:filtered,nextCursor:hasMore?String(items.at(-1).id):null,hasMore});
  }
  if(!match)return fail('IClick workspace route not found.',404);
  const id=match[1],fileKey=match[2],listing=await activeListing(db,id);if(!listing)return fail('Active, unarchived category listing not found.',404);
  if(!fileKey&&request.method==='POST'){
   const mime=(request.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase(),bytes=await readBody(request);const ext=imageExtension(bytes,mime),media=services.media(env);if(!media)return fail('Private image storage is not configured.',503);
   if(!bytes.length)return fail('Choose an image to upload.',400);
   const key=`${crypto.randomUUID()}.${ext}`,objectKey=`iclick/${id}/${key}`,title=(request.headers.get('X-File-Name')||'Listing image').replace(/[\r\n\\/]/g,' ').trim().slice(0,160)||'Listing image';
   await media.put(objectKey,bytes,{httpMetadata:{contentType:mime}});
   try{
    const rows=await db.query('INSERT INTO iclick_listing_images(listing_id,file_key,object_key,title,content_type,byte_size,created_by_name) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,listing_id AS "listingId",file_key AS "fileKey",title,content_type AS "contentType",byte_size AS "byteSize",created_at AS "createdAt"',[Number(id),key,objectKey,title,mime,bytes.length,user.displayName||user.username]);
    return json({success:true,data:{...rows[0],url:new URL(`/api/iclick-workspace/listings/${id}/images/${key}`,request.url).toString()}},201);
   }catch(error){try{await media.delete(objectKey);}catch{console.error('IClick image cleanup failed after metadata insert error');}throw error;}
  }
  if(!fileKey)return fail('Method not allowed.',405);
  if(!keyPattern.test(fileKey))return fail('Invalid image key.',400);
  const image=(await db.query('SELECT id,listing_id AS "listingId",file_key AS "fileKey",object_key AS "objectKey",title,content_type AS "contentType",byte_size AS "byteSize",created_at AS "createdAt" FROM iclick_listing_images WHERE listing_id=$1 AND file_key=$2',[Number(id),fileKey]))[0];
  if(!image)return fail('Listing image not found.',404);
  const media=services.media(env);if(!media)return fail('Private image storage is not configured.',503);
  if(request.method==='DELETE'){
   await db.query('DELETE FROM iclick_listing_images WHERE id=$1',[image.id]);
   try{await media.delete(image.objectKey);}catch{console.error('IClick image object cleanup failed after metadata deletion');}
   return json({success:true});
  }
  if(request.method!=='GET')return fail('Method not allowed.',405);
  const object=await media.get(image.objectKey,{range:request.headers});if(!object)return fail('Listing image object not found.',404);
  const headers=new Headers({'Content-Type':image.contentType,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'});
  if(object.range){headers.set('Content-Range',`bytes ${object.range.offset}-${object.range.offset+object.range.length-1}/${object.size}`);headers.set('Content-Length',String(object.range.length));headers.set('Accept-Ranges','bytes');return new Response(object.body,{status:206,headers});}
  headers.set('Content-Length',String(object.size));return new Response(object.body,{headers});
 }catch(error){const status=(error as any)?.status;return fail(status===413?'Images must be 15 MB or smaller.':status===400?(error as Error).message:'Unable to save or load IClick listing images. Please try again.',status===413?413:status===400?400:500);}
}
