import {validatePublicationInput} from '../../src/publications';
import {json} from './_db';
import type {AuthUser} from './_auth';
import type {PublicationsServices} from './_publications';
export async function mutatePublication(db:ReturnType<PublicationsServices['connect']>,user:AuthUser,listingId:number,id:number|undefined,method:string,body:Record<string,unknown>){
 const error=(message:string,status:number)=>json({success:false,error:message},status);
 if(method!=='POST'&&(!Number.isInteger(body.version)||Number(body.version)<1))return error('Refresh the property card before saving. A current advertisement version is required.',428);
 const input=method==='DELETE'?null:validatePublicationInput(body);
 const params=[listingId,id||null,body.version||null,String(user.id),user.displayName||user.username,input?.channelId??null,input?.url??null,input?.label??null,input?.notes??null];
 const parent='parent AS MATERIALIZED (SELECT id FROM listings WHERE id=$1 AND archived_at IS NULL FOR UPDATE)';
 const old='old AS MATERIALIZED (SELECT p.* FROM listing_publications p JOIN parent ON parent.id=p.listing_id WHERE p.id=$2 FOR UPDATE OF p)';
 const channel='channel AS MATERIALIZED (SELECT id,archived_at FROM publication_channels WHERE id=$6 FOR UPDATE)';
 let query:string;
 if(method==='POST')query=`WITH ${parent},${channel},changed AS (INSERT INTO listing_publications(listing_id,channel_id,url,label,notes) SELECT parent.id,channel.id,$7,$8,$9 FROM parent,channel WHERE channel.archived_at IS NULL RETURNING *),audit AS (INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name) SELECT listing_id,'advertisement_create',jsonb_build_object('before',NULL,'after',to_jsonb(changed))::text,$4,$5 FROM changed) SELECT * FROM changed`;
 else if(method==='PATCH')query=`WITH ${parent},${old},${channel},changed AS (UPDATE listing_publications p SET channel_id=c.id,url=$7,label=$8,notes=$9,version=p.version+1,updated_at=now() FROM old o,channel c WHERE p.id=o.id AND p.version=$3 AND o.version=$3 AND (c.archived_at IS NULL OR o.channel_id=c.id) RETURNING p.*),audit AS (INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name) SELECT n.listing_id,'advertisement_update',jsonb_build_object('before',to_jsonb(o),'after',to_jsonb(n))::text,$4,$5 FROM changed n JOIN old o ON o.id=n.id) SELECT * FROM changed`;
 else query=`WITH ${parent},${old},changed AS (DELETE FROM listing_publications p USING old o WHERE p.id=o.id AND p.version=$3 AND o.version=$3 RETURNING p.*),audit AS (INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name) SELECT listing_id,'advertisement_remove',jsonb_build_object('before',to_jsonb(changed),'after',NULL)::text,$4,$5 FROM changed) SELECT * FROM changed`;
 // PostgreSQL cannot infer unused placeholder types, so pass only the parameters each statement needs with explicit casts in a leading CTE.
 query=query.replace('WITH ',`WITH args AS (SELECT $1::int,$2::int,$3::int,$4::text,$5::text,$6::int,$7::text,$8::text,$9::text), `);
 const row=(await db.query(query,params))[0];
 if(!row){
  if(!(await db.query('SELECT id FROM listings WHERE id=$1 AND archived_at IS NULL',[listingId]))[0])return error('This property is archived or no longer available. Refresh the listings.',409);
  if(id&&!(await db.query('SELECT id FROM listing_publications WHERE id=$1 AND listing_id=$2',[id,listingId]))[0])return error('Advertisement not found.',404);
  return error(method==='POST'?'Select an active publication channel.':'This advertisement changed, or its channel is unavailable. Reopen the property card and review the latest version.',method==='POST'?400:409);
 }
 return json({success:true,data:{id:row.id,listingId:row.listing_id,channelId:row.channel_id,url:row.url,label:row.label,notes:row.notes,version:row.version}},method==='POST'?201:200);
}
