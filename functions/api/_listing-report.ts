import {json,listingColumns} from './_db';
import type {AuthEnv,AuthUser} from './_auth';
import type {OwnerServices} from './_owner-listings';
import {parseListingReport,reportIdentity,reportPropertyName} from '../../src/listingReport';
import {PROJECT_CATEGORIES,type PropertyListing} from '../../src/types';
import {validatePublicationInput} from '../../src/publications';
import {normalizeSummaryPhone} from '../../src/ownerSummaryReport';
const fail=(error:string,status=400)=>json({error},status);
export async function importListingReport(request:Request,env:AuthEnv,services:OwnerServices,user:AuthUser){
 try{
  if(request.method!=='POST')return fail('Method not allowed.',405);
  const raw=await request.text();if(raw.length>256000)return fail('Report request is too large.',413);
  let body:any;try{body=JSON.parse(raw);}catch{return fail('Invalid report request.');}
  if(!body||!['preview','commit'].includes(body.mode)||typeof body.report!=='string')return fail('Paste a property report first.');
  const db=services.connect(env),channels=await db.query('SELECT id,name,archived_at AS "archivedAt" FROM publication_channels');
  const listings=await db.query(`SELECT ${listingColumns} FROM listings`) as unknown as PropertyListing[];
  const ownerLocations=await db.query("SELECT DISTINCT location FROM owner_listings WHERE location IS NOT NULL AND trim(location)<>''");
  let report;try{report=parseListingReport(body.report,channels as any,[...listings.map(l=>l.location||''),...ownerLocations.map(o=>String(o.location))]);}catch(e){return fail((e as Error).message);}
  const refs=report.reference?await db.query(`SELECT listing_id FROM listing_report_references WHERE reference=$1 UNION SELECT l.id FROM listings l JOIN owner_listing_events e ON e.listing_id=l.source_owner_listing_id WHERE e.action='summary_report' AND e.after_record->>'reportReference'=$1`,[report.reference]):[];
  const byRef=listings.filter(l=>refs.some(r=>Number(r.listing_id)===l.id));
  const byName=listings.filter(l=>reportIdentity(reportPropertyName(l.property))===reportIdentity(report.property));
  const candidates=byRef.length?byRef:byName;
  const only=candidates.length===1?candidates[0]:null;
  const selected=only&&(byRef.length||!normalizeSummaryPhone(only.noTel||'')||!normalizeSummaryPhone(report.phone)||normalizeSummaryPhone(only.noTel||'')===normalizeSummaryPhone(report.phone))?only:null;
  if(body.mode==='preview')return json({success:true,data:{...report,candidates,selectedListingId:selected?.id||null,...(candidates.length>1?{issue:'Multiple listings match. Choose the correct property.'}:{})}});
  if(!PROJECT_CATEGORIES.includes(body.category))return fail('Choose the destination listing category.');
  if(report.category==='Rental'&&body.category!=='Rental'||report.category&&report.category!=='Rental'&&body.category==='Rental')return fail('Report type conflicts with the selected category.');
  const creating=body.listingId===null&&body.createNew===true;
  const target=listings.find(l=>l.id===body.listingId);
  const retryId=creating?(await db.query("SELECT listing_id FROM listing_audit_logs WHERE action='listing_report' AND changed_fields::jsonb->>'reportText'=$1 AND changed_fields::jsonb->>'createdNew'='true' ORDER BY id LIMIT 1",[body.report.trim()]))[0]?.listing_id:null;
  if(!creating&&(!Number.isSafeInteger(body.listingId)||!target||!Number.isInteger(body.version)||body.version<1))return fail('Choose a listing and refresh its current version.');
  if(creating&&candidates.some(l=>l.id!==Number(retryId)))return fail('A matching listing already exists. Review it before creating another.',409);
  if(byRef.length&&byRef.some(l=>l.id!==(target?.id||Number(retryId))))return fail('This reference is linked to another listing.',409);
  if(target&&target.projectCategory!==body.category)return fail('Use the existing listing category.');
  if(!Array.isArray(body.links)||body.links.length>100)return fail('Review up to 100 advertisement links.');
  const links:any[]=[];
  for(const link of body.links){
   try{validatePublicationInput(link);}catch(e){return fail((e as Error).message);}
   const parsed=report.links.find(l=>l.url===link.url&&!l.issue);if(!parsed)return fail('Only links from the pasted report can be imported.');
   if(!channels.some(c=>Number(c.id)===link.channelId&&!c.archivedAt))return fail('Select an active publication channel.');
   if(!links.some(l=>l.url===link.url))links.push({url:link.url,label:parsed.label,channelId:link.channelId});
  }
  if(!services.transact)throw new Error('Transaction unavailable');
  const actor=String(user.id),name=user.displayName||user.username;
  if(body.location!==undefined&&(typeof body.location!=='string'||body.location.length>300))return fail('Location must be at most 300 characters.');
  const location=(body.location===undefined?report.location:body.location.trim())||'Pending details';
  const missingLocation="lower(trim(coalesce(l.location,''))) IN ('','-','pending','pending details','location not provided','not provided','not captured','unknown')";
  const repairName=target&&reportPropertyName(target.property)!==target.property&&reportIdentity(reportPropertyName(target.property))===reportIdentity(report.property)?target.property:null;
  const information=`Listing report\n${report.reference?'Reference: '+report.reference+'\n':''}${report.ownerName?'Owner: '+report.ownerName+'\n':''}${report.phone?'Contact: '+report.phone+'\n':''}${report.price?'Price: RM'+report.price+'\n':''}${creating?'Pending details: complete missing location, tenure, lister, availability and publication schedule.\n':''}\n${body.report.trim()}`;
  // One transaction locks all listing writers, repeats identity checks against current data,
  // then updates the property, reference, links and audit history together.
  const statements:any[]=[{sql:"SET LOCAL lock_timeout='8s'",params:[]},{sql:'LOCK TABLE owner_listings IN SHARE ROW EXCLUSIVE MODE',params:[]},{sql:'LOCK TABLE listings IN SHARE ROW EXCLUSIVE MODE',params:[]}];
  statements.push({sql:`SELECT 1/(CASE WHEN NOT EXISTS(SELECT 1 FROM owner_listing_events e JOIN listings l ON l.source_owner_listing_id=e.listing_id WHERE e.action='summary_report' AND e.after_record->>'reportReference'=$1 AND ($2::int IS NULL OR l.id<>$2::int)) THEN 1 ELSE 0 END)`,params:[report.reference,target?.id||Number(retryId)||null]});
  // Retry of a newly created report resolves through its audit report text, including reports without references.
  const retry=`SELECT listing_id FROM listing_audit_logs WHERE action='listing_report' AND (changed_fields::jsonb)->>'reportText'=$1 AND (changed_fields::jsonb)->>'createdNew'='true'`;
  statements.push({sql:`SELECT 1/(CASE WHEN ${creating?`NOT EXISTS(SELECT 1 FROM listings WHERE lower(regexp_replace(property,'[^a-zA-Z0-9]+',' ','g'))=lower(regexp_replace($2,'[^a-zA-Z0-9]+',' ','g')) AND id NOT IN (${retry}))`:`EXISTS(SELECT 1 FROM listings WHERE id=$3 AND version=$4 AND $1::text IS NOT NULL AND $2::text IS NOT NULL)`} THEN 1 ELSE 0 END)`,params:creating?[body.report.trim(),report.property]:[body.report.trim(),report.property,target!.id,body.version]});
  const targetSql=creating?`COALESCE((SELECT listing_id FROM listing_audit_logs WHERE action='listing_report' AND changed_fields::jsonb->>'reportText'=$1 AND changed_fields::jsonb->>'createdNew'='true' ORDER BY id LIMIT 1),nextval(pg_get_serial_sequence('listings','id'))::int)`:'(SELECT $2::int WHERE $1::text IS NOT NULL)';
  statements.push({sql:`WITH chosen AS MATERIALIZED(SELECT ${targetSql} AS id WHERE ($2::int IS NULL OR $2::int>0) AND $3::text IS NOT NULL AND $4::text IS NOT NULL AND ($13::text IS NULL OR true)),old AS MATERIALIZED(SELECT l.* FROM listings l JOIN chosen c ON c.id=l.id),changed AS(
   ${creating?`INSERT INTO listings(id,property,project_category,location,tenure,pm,agent,no_tel,available_units,status,date,renew_status,notes,created_by_user_id,created_by_name,updated_by_user_id,updated_by_name,last_updated_at)
    SELECT c.id,$3,$4,$12,'-','-',$5,$6,'-','Pending','','Not Renewed',$7,$8,$9,$8,$9,now() FROM chosen c WHERE NOT EXISTS(SELECT 1 FROM old) RETURNING *`:
   `UPDATE listings l SET location=CASE WHEN ${missingLocation} THEN $12 ELSE l.location END,property=CASE WHEN l.property=$13 THEN $3 ELSE l.property END,agent=CASE WHEN EXISTS(SELECT 1 FROM listing_audit_logs a WHERE a.listing_id=l.id AND a.action='listing_report' AND a.changed_fields::jsonb->>'reportText'=$1) THEN l.agent ELSE coalesce(nullif($5,''),l.agent) END,no_tel=CASE WHEN EXISTS(SELECT 1 FROM listing_audit_logs a WHERE a.listing_id=l.id AND a.action='listing_report' AND a.changed_fields::jsonb->>'reportText'=$1) THEN l.no_tel ELSE coalesce(nullif($6,''),l.no_tel) END,notes=CASE WHEN EXISTS(SELECT 1 FROM listing_audit_logs a WHERE a.listing_id=l.id AND a.action='listing_report' AND a.changed_fields::jsonb->>'reportText'=$1) THEN l.notes ELSE concat_ws(E'\n\n',nullif(l.notes,''),$7::text) END,archived_at=NULL,archived_by_name=NULL,version=l.version+1,updated_by_user_id=$8,updated_by_name=$9,last_updated_at=now() FROM chosen c WHERE l.id=c.id AND (l.archived_at IS NOT NULL OR (${missingLocation} AND $12<>'Pending details') OR l.property=$13 OR NOT EXISTS(SELECT 1 FROM listing_audit_logs a WHERE a.listing_id=l.id AND a.action='listing_report' AND a.changed_fields::jsonb->>'reportText'=$1)) RETURNING l.*`}
   ),audit AS(INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name) SELECT c.id,'listing_report',jsonb_build_object('before',(SELECT to_jsonb(o) FROM old o),'after',to_jsonb(c),'reportText',$1::text,'createdNew',$10::boolean)::text,$8,$9 FROM changed c),reference AS(
    INSERT INTO listing_report_references(reference,listing_id) SELECT $11,c.id FROM chosen c WHERE $11<>'' ON CONFLICT(reference) DO UPDATE SET reference=excluded.reference WHERE listing_report_references.listing_id=excluded.listing_id RETURNING listing_id)
   SELECT id FROM chosen`,params:[body.report.trim(),target?.id||null,report.property,body.category,report.ownerName,report.phone,information,actor,name,creating,report.reference,location,repairName]});
  // Resolve using audit text inside the transaction; its property audit is written before these statements.
  const resolve=creating?`(SELECT listing_id FROM listing_audit_logs WHERE action='listing_report' AND changed_fields::jsonb->>'reportText'=$1 AND changed_fields::jsonb->>'createdNew'='true' AND ($2::int IS NULL OR $2::int>0) ORDER BY id LIMIT 1)`:'(SELECT $2::int WHERE $1::text IS NOT NULL)';
  statements.push({sql:`SELECT 1/(CASE WHEN $3='' OR EXISTS(SELECT 1 FROM listing_report_references WHERE reference=$3 AND listing_id=${resolve}) THEN 1 ELSE 0 END)`,params:[body.report.trim(),target?.id||null,report.reference]});
  statements.push({sql:`WITH input AS(SELECT * FROM jsonb_to_recordset($3::jsonb) AS i(url text,label text,"channelId" int)),valid AS MATERIALIZED(SELECT c.id FROM publication_channels c WHERE c.archived_at IS NULL AND c.id IN(SELECT "channelId" FROM input) FOR SHARE),guard AS MATERIALIZED(SELECT 1/(CASE WHEN (SELECT count(*) FROM valid)=(SELECT count(DISTINCT "channelId") FROM input) THEN 1 ELSE 0 END) AS ok),added AS(
   INSERT INTO listing_publications(listing_id,channel_id,url,label) SELECT ${resolve},i."channelId",i.url,i.label FROM input i,guard g WHERE g.ok=1 AND NOT EXISTS(SELECT 1 FROM listing_publications p WHERE p.listing_id=${resolve} AND p.url=i.url) RETURNING *),audit AS(
   INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name) SELECT listing_id,'advertisement_create',jsonb_build_object('before',NULL,'after',to_jsonb(a))::text,$4,$5 FROM added a) SELECT ${resolve} AS "listingId",count(*)::int AS added FROM added`,params:[body.report.trim(),target?.id||null,JSON.stringify(links),actor,name]});
  try{const results=await services.transact(env,statements);return json({success:true,data:results[results.length-1][0]});}catch(e:any){if(['22012','23505','55P03','40001','40P01'].includes(e.code))return fail('This listing, reference or channel changed. Preview the report again before importing.',409);throw e;}
 }catch{return fail('Unable to import this report. Your existing data has been preserved.',500);}
}
