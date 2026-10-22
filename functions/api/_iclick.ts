import {getDb,type PagesEnv} from './_db';
import {neonWorkflowBucket} from '../../src/server/workflow/neon-storage';
import type {WorkflowBucket} from './_workflow';

export interface IclickEnv extends PagesEnv {ICLICK_API_TOKEN?:string;NEON_STORAGE_CONFIG?:string;ICLICK_MEDIA?:WorkflowBucket}
interface IclickDb {query:(sql:string,params?:unknown[])=>Promise<any[]>}
export interface IclickServices {connect:(env:IclickEnv)=>IclickDb;media:(env:IclickEnv)=>WorkflowBucket|undefined}
const production:IclickServices={connect:getDb,media:env=>env.ICLICK_MEDIA||neonWorkflowBucket(env.NEON_STORAGE_CONFIG)};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});

async function authorized(request:Request,configured?:string){
 if(!configured)return null;
 const match=request.headers.get('Authorization')?.match(/^Bearer\s+([^\s]+)$/i);
 if(!match)return false;
 const expected=new TextEncoder().encode(configured),received=new TextEncoder().encode(match[1]);
 if(expected.length!==received.length)return false;
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected[i]^received[i];
 return diff===0;
}
function usableMaterials(data:any){
 const current=Array.isArray(data?.materials)?data.materials.filter((item:any)=>item&&!item.replacedBy&&!item.archivedAt&&!item.original&&item.review==='approved'):[];
 const copy=[...current].filter((item:any)=>item.kind==='copy'&&typeof item.text==='string'&&item.text.trim()).sort((a:any,b:any)=>String(b.at||'').localeCompare(String(a.at||'')))[0];
 const images=current.filter((item:any)=>['photo','poster'].includes(item.kind)&&typeof item.fileKey==='string'&&typeof item.mime==='string'&&item.mime.startsWith('image/'))
   .sort((a:any,b:any)=>String(a.at||'').localeCompare(String(b.at||'')));
 return {copy,images};
}
const fileKeyPattern=/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/i;

export async function handleIclick({request,env}:{request:Request;env:IclickEnv},services:IclickServices=production):Promise<Response>{
 try{
  if(request.method!=='GET')return new Response(JSON.stringify({error:'This integration is read-only.'}),{status:405,headers:{'Content-Type':'application/json','Allow':'GET','Cache-Control':'no-store'}});
  const auth=await authorized(request,env.ICLICK_API_TOKEN);
  if(auth===null)return response({error:'The IClick integration has not been configured.'},503);
  if(!auth)return response({error:'A valid bearer token is required.'},401);
  const url=new URL(request.url),route=url.pathname.replace(/^\/api\/v1\/iclick\/?/,'');
  const imageMatch=/^listings\/(\d+)\/images\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/i.exec(route);
  const listingMatch=/^listings\/(\d+)$/.exec(route);
  if(route==='listings'||listingMatch){
   const rawLimit=Number(url.searchParams.get('limit')||50),limit=Number.isSafeInteger(rawLimit)?Math.min(100,Math.max(1,rawLimit)):50;
   const cursorValue=url.searchParams.get('cursor'),cursor=cursorValue===null?0:Number(cursorValue);
   if(!Number.isSafeInteger(cursor)||cursor<0)return response({error:'cursor must be a non-negative listing ID.'},400);
   const requestedId=listingMatch?Number(listingMatch[1]):null;
   if(listingMatch&&(requestedId===null||!Number.isSafeInteger(requestedId)||requestedId<=0))return response({error:'Invalid listing ID.'},400);
   const rows=await services.connect(env).query(`
    SELECT l.id,l.property,l.project_category AS "projectCategory",l.location,l.tenure,
      l.available_units AS "availableUnits",l.asking_price::text AS "askingPrice",l.status,
      l.agent,l.negotiator,l.no_tel AS "contactPhone",l.last_updated_at AS "updatedAt",
      (SELECT r.reference FROM listing_report_references r WHERE r.listing_id=l.id ORDER BY r.created_at DESC LIMIT 1) AS reference,
      COALESCE((SELECT json_agg(json_build_object('channel',pc.name,'url',p.url,'label',p.label) ORDER BY pc.name)
        FROM listing_publications p JOIN publication_channels pc ON pc.id=p.channel_id WHERE p.listing_id=l.id),'[]'::json) AS publications,
      w.data AS "workflowData"
    FROM listings l LEFT JOIN marketing_workflows w ON w.listing_id=l.id
    WHERE l.id=COALESCE($1,l.id) AND l.id>$2 AND l.status='Active' AND l.archived_at IS NULL
    ORDER BY l.id ASC LIMIT $3`,[requestedId,cursor,limit+1]);
   const hasMore=!listingMatch&&rows.length>limit,items=rows.slice(0,listingMatch?1:limit);
   const listingIds=items.map((row:any)=>Number(row.id));
   const uploadedImages=listingIds.length?await services.connect(env).query(`
    SELECT id,listing_id AS "listingId",file_key AS "fileKey",title,content_type AS "contentType",created_at AS "createdAt"
    FROM iclick_listing_images WHERE listing_id=ANY($1::int[]) ORDER BY id`,[listingIds]):[];
   const data=items.map((row:any)=>{
    const {copy,images:workflowImages}=usableMaterials(row.workflowData),missing:string[]=[];
    const images=[...uploadedImages.filter((image:any)=>Number(image.listingId)===Number(row.id)).map((image:any)=>({
     id:String(image.id),title:image.title||'Listing image',mime:image.contentType,
     fileKey:image.fileKey,source:'iclick',at:image.createdAt,
    })),...workflowImages.map((image:any)=>({...image,source:'workflow'}))];
    const price=row.askingPrice===null||row.askingPrice===undefined||row.askingPrice===''?NaN:Number(row.askingPrice);
    if(!String(row.property||'').trim()||/^pending(?: details)?$/i.test(String(row.property).trim()))missing.push('property');
    if(!String(row.location||'').trim()||/^pending(?: details)?$/i.test(String(row.location).trim()))missing.push('location');
    if(!Number.isFinite(price)||price<=0)missing.push('numeric_price');
    if(!copy)missing.push('approved_copywriting');
    if(!images.length)missing.push('approved_image');
    const base={id:Number(row.id),reference:row.workflowData?.brief?.reference||row.reference||null,property:row.property,category:row.projectCategory,
      location:row.location,tenure:row.tenure||null,availableUnits:row.availableUnits||null,askingPrice:Number.isFinite(price)?price:null,
      currency:'MYR',status:row.status,agent:row.agent||null,negotiator:row.negotiator||null,contactPhone:row.contactPhone||null,
      details:row.workflowData?.brief?.details||null,copywriting:copy?.text||null,
      images:images.map((item:any)=>({id:item.id,title:item.title||'Listing image',contentType:item.mime,url:new URL(`/api/v1/iclick/listings/${row.id}/images/${item.fileKey}`,url.origin).toString()})),
      publications:Array.isArray(row.publications)?row.publications:[],publishReady:missing.length===0,missing,updatedAt:row.updatedAt};
    return base;
   });
   if(listingMatch&&!data.length)return response({error:'Active, unarchived category listing not found.'},404);
   return response({version:'1.0',data,...(hasMore?{nextCursor:String(items.at(-1).id)}:{})});
  }
  if(imageMatch){
   const listingId=Number(imageMatch[1]),fileKey=imageMatch[2],db=services.connect(env);
   const uploaded=(await db.query("SELECT i.object_key AS \"objectKey\",i.content_type AS \"contentType\" FROM iclick_listing_images i JOIN listings l ON l.id=i.listing_id WHERE l.id=$1 AND l.status='Active' AND l.archived_at IS NULL AND i.file_key=$2",[listingId,fileKey]))[0];
   const row=uploaded?null:(await db.query("SELECT w.data FROM marketing_workflows w JOIN listings l ON l.id=w.listing_id WHERE l.id=$1 AND l.status='Active' AND l.archived_at IS NULL",[listingId]))[0];
   const material=(row?.data?.materials||[]).find((item:any)=>item?.fileKey===fileKey&&!item.replacedBy&&!item.archivedAt&&!item.original&&item.review==='approved'&&['photo','poster'].includes(item.kind)&&typeof item.mime==='string'&&item.mime.startsWith('image/'));
   if((!uploaded&&!material)||!fileKeyPattern.test(fileKey))return response({error:'Approved listing image not found.'},404);
   const bucket=services.media(env);if(!bucket)return response({error:'Private image storage is not configured.'},503);
   const object=await bucket.get(uploaded?uploaded.objectKey:`${row.data.id}/${fileKey}`,{range:request.headers});if(!object)return response({error:'Listing image not found.'},404);
   const headers=new Headers({'Content-Type':uploaded?.contentType||material.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'});
   if(object.range){headers.set('Content-Range',`bytes ${object.range.offset}-${object.range.offset+object.range.length-1}/${object.size}`);headers.set('Content-Length',String(object.range.length));headers.set('Accept-Ranges','bytes');return new Response(object.body,{status:206,headers});}
   headers.set('Content-Length',String(object.size));return new Response(object.body,{headers});
  }
  return response({error:'IClick API route not found.'},404);
 }catch(error){
  console.error('IClick API request failed',error instanceof Error?error.name:'UnknownError');
  return response({error:'Unable to read listing data. Please retry shortly.'},500);
 }
}
