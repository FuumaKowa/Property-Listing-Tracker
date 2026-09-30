import {getDb,json,listingColumns} from './_db';
import {getSessionUser,type AuthEnv} from './_auth';
import {objectInput,PublicationValidationError,validateRepostFields} from '../../src/publications';
import {validatePriority} from '../../src/utils/listingPresentation';

export const listingFields:Record<string,string>={property:'property',projectCategory:'project_category',location:'location',tenure:'tenure',pm:'pm',negotiator:'negotiator',agent:'agent',noTel:'no_tel',availableUnits:'available_units',status:'status',date:'date',renewStatus:'renew_status',notes:'notes',propertyGuruRepostDate:'property_guru_repost_date',propertyGuruRepostMode:'property_guru_repost_mode',isPriority:'is_priority'};
export type ListingServices={getDb:typeof getDb;getSessionUser:typeof getSessionUser};
type Context={env:AuthEnv;request:Request;id?:string;restore?:boolean};
const fail=(error:string,status:number)=>json({success:false,error},status);
export async function handleListings({env,request,id,restore=false}:Context,services={getDb,getSessionUser}):Promise<Response>{
 try {
  const user=await services.getSessionUser(request,env);if(!user)return fail('Authentication required.',401);
  const db=services.getDb(env), method=request.method;
  if(method==='GET'&&!id){
   const archived=new URL(request.url).searchParams.get('archived')==='true';
   return json({success:true,data:await db.query(`SELECT ${listingColumns} FROM listings WHERE archived_at IS ${archived?'NOT ':''}NULL ORDER BY id`)});
  }
  if(!['POST','PATCH','DELETE'].includes(method))return fail('Method not allowed.',405);
  const body=objectInput(await request.json());
  const actor=String(user.id),name=user.displayName||user.username;
  if(method==='POST'&&!id){
   if(typeof body.property!=='string'||!body.property.trim()||typeof body.location!=='string'||!body.location.trim())return fail('Property and location are required.',400);
   const input=validated(body);
   const data={projectCategory:'Project Marketing (PM)',tenure:'-',pm:'-',availableUnits:'-',status:'Active',date:'',renewStatus:'Not Renewed',...input};
   const keys=Object.keys(data);const params:any[]=Object.values(data);params.push(actor,name);
   const uid=`$${params.length-1}`,uname=`$${params.length}`;
   const rows=await db.query(`WITH changed AS (
    INSERT INTO listings(${keys.map(k=>listingFields[k]).join(',')},created_by_user_id,created_by_name,updated_by_user_id,updated_by_name,last_updated_at)
    VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')},${uid},${uname},${uid},${uname},now()) RETURNING *
   ), audit AS (INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name)
    SELECT id,'create',jsonb_build_object('before',NULL,'after',to_jsonb(changed))::text,${uid},${uname} FROM changed)
   SELECT ${listingColumns} FROM changed`,params);
   return json({success:true,data:rows[0]},201);
  }
  if(!id||! /^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))return fail('Invalid listing ID.',400);
  if(!Number.isInteger(body.version)||Number(body.version)<1)return fail('Refresh this listing before saving. A current version is required.',428);
  const action=restore?'restore':method==='DELETE'?'archive':'update';
  if(restore&&method!=='POST'||!restore&&method==='POST')return fail('Method not allowed.',405);
  const input=action==='update'?validated(body):{};
  const params:any[]=[Number(id),body.version,actor,name];
  const sets=Object.entries(input).map(([key,value])=>{params.push(value);return `${listingFields[key]}=$${params.length}`;});
  if(action==='archive')sets.push('archived_at=now()','archived_by_name=$4');
  if(action==='restore')sets.push('archived_at=NULL','archived_by_name=NULL');
  if(action==='update'&&!sets.length)return fail('No editable changes supplied.',400);
  sets.push('version=l.version+1','updated_by_user_id=$3','updated_by_name=$4','updated_by_email=NULL','last_updated_at=now()');
  const rows=await db.query(`WITH old AS MATERIALIZED (SELECT * FROM listings WHERE id=$1 FOR UPDATE),
   changed AS (UPDATE listings l SET ${sets.join(',')} FROM old o WHERE l.id=o.id AND l.version=$2 AND o.version=$2 AND o.archived_at IS ${restore?'NOT ':''}NULL RETURNING l.*),
   audit AS (INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name)
    SELECT c.id,'${action}',jsonb_build_object('before',to_jsonb(o),'after',to_jsonb(c))::text,$3,$4 FROM changed c JOIN old o ON o.id=c.id)
   SELECT ${listingColumns} FROM changed`,params);
  if(!rows[0]){
   const current=(await db.query(`SELECT ${listingColumns} FROM listings WHERE id=$1`,[Number(id)]))[0];
   return current?json({success:false,error:'This listing changed or was archived. Refresh it and review the latest information before trying again.',current},409):fail('Listing not found.',404);
  }
  return json({success:true,data:rows[0]});
 }catch(e){
  if(e instanceof PublicationValidationError||e instanceof SyntaxError)return fail(e instanceof SyntaxError?'Invalid JSON.':e.message,400);
  return fail('Unable to save or load listings. Please try again.',500);
 }
}
function validated(body:Record<string,unknown>){
 const input:Record<string,unknown>={...validateRepostFields(body),...validatePriority(body)};
 for(const key of Object.keys(listingFields)){
  if(!(key in body)||key in input)continue;
  if(typeof body[key]!=='string')throw new PublicationValidationError(`${key} must be text.`);
  if(['property','location'].includes(key)&&!(body[key] as string).trim())throw new PublicationValidationError(`${key} cannot be empty.`);
  input[key]=body[key];
 }
 return input;
}
