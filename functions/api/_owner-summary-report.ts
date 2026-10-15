import {json} from './_db';
import type {AuthEnv,AuthUser} from './_auth';
import type {OwnerServices} from './_owner-listings';
import {readOwnerListings} from '../../src/db/ownerListings';
import {ownerPromotionCtes} from './_owner-promotion';
import {parseOwnerSummaryReport,applySummaryReferenceEdits,matchOwnerSummaryEntry,normalizeSummaryPhone,type SummaryChoice,type SummaryPreview,type SummaryRow} from '../../src/ownerSummaryReport';

const fail=(error:string,status=400)=>json({error},status);
const isAdmin=(user:AuthUser)=>['admin','super_admin'].includes(user.role);
const editable=(row:any,user:AuthUser)=>isAdmin(user)||row.assignedAgentId===user.id;
class SummaryInputError extends Error {}
function parseReport(text:string){try{return parseOwnerSummaryReport(text);}catch(error){throw new SummaryInputError(error instanceof Error?error.message:'Invalid report.');}}
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
type StoredReport={id:string;created_by:number;report_text:string;outcomes:Record<string,any>;choices:Record<string,SummaryChoice>};
function choicesInput(raw:unknown):SummaryChoice[]{
 if(!Array.isArray(raw)||raw.length>100)throw new SummaryInputError('Review up to 100 report rows.');
 const seen=new Set<number>();
 return raw.map(value=>{
  if(!value||typeof value!=='object'||!Number.isInteger(value.row)||value.row<1||seen.has(value.row))throw new SummaryInputError('Each report row must have one choice.');seen.add(value.row);
  if(value.ownerId!==null&&(!Number.isSafeInteger(value.ownerId)||value.ownerId<1))throw new SummaryInputError('Select a valid master owner listing.');
  if(value.ownerId!==null&&value.defer!==true&&(!Number.isInteger(value.version)||value.version<1))throw new SummaryInputError('Refresh the matches before applying.');
  if(value.reference!==undefined&&(typeof value.reference!=='string'||value.reference.length>40))throw new SummaryInputError('Enter a valid WTL or WTS reference.');
  return {row:value.row,ownerId:value.ownerId,version:value.version,reference:value.reference?.trim().toUpperCase(),createNew:value.createNew===true,defer:value.defer===true};
 });
}
async function previewReport(record:StoredReport,env:AuthEnv,services:OwnerServices,user:AuthUser):Promise<SummaryPreview>{
 const db=services.connect(env),owners=await readOwnerListings(db);
 const entries=applySummaryReferenceEdits(parseReport(record.report_text),[...Object.values(record.choices||{}),...Object.entries(record.outcomes||{}).map(([row,value])=>({row:Number(row),reference:value.reference}))]);
 const references=await db.query("SELECT listing_id,after_record->>'reportReference' AS reference FROM owner_listing_events WHERE action='summary_report'");
 const linked=await db.query('SELECT source_owner_listing_id,project_category FROM listings WHERE source_owner_listing_id IS NOT NULL');
 const rows:SummaryRow[]=entries.map(entry=>{
  const result=matchOwnerSummaryEntry(entry,owners,user),outcome=record.outcomes?.[entry.row];
  if(outcome)return {...result,state:'applied',selectedOwnerId:outcome.ownerId,selectedVersion:owners.find(o=>o.id===outcome.ownerId)?.version||null};
  result.canCreate=!entry.issues.length&&!owners.some(o=>o.propertyName.toLowerCase().replace(/[^a-z0-9]/g,'')===entry.property.toLowerCase().replace(/[^a-z0-9]/g,'')||normalizeSummaryPhone(o.noTel)&&normalizeSummaryPhone(o.noTel)===normalizeSummaryPhone(entry.phone))&&!references.some(e=>e.reference===entry.reference);
  result.createNew=result.canCreate;
  const saved=record.choices?.[entry.row];
  if(saved){
   result.createNew=!!saved.createNew&&result.canCreate;
   const owner=owners.find(o=>o.id===saved.ownerId);result.selectedOwnerId=saved.ownerId;result.selectedVersion=owner?.version||null;
   if(owner&&!result.candidates.some(c=>c.id===owner.id))result.candidates.push({...owner,reason:'Manually selected',canEdit:editable(owner,user)});
   result.state=owner&&editable(owner,user)&&!entry.issues.length&&(!owner.transactionType||owner.transactionType===entry.transactionType)?'ready':'pending';
   if(result.state==='ready')result.issue=undefined;
  }
  if(result.selectedOwnerId){
   const conflict=references.some(e=>e.reference===entry.reference&&Number(e.listing_id)!==result.selectedOwnerId),category=linked.find(l=>Number(l.source_owner_listing_id)===result.selectedOwnerId);
   if(conflict||category&&category.project_category!==(entry.transactionType==='rent'?'Rental':'Subsale Direct Listing (SSDL)')){
    result.state='pending';result.issue=conflict?'This reference is already linked to another property. Correct it before applying.':'The existing category listing conflicts with this report type.';result.selectedOwnerId=null;result.selectedVersion=null;
   }
  }
  if(result.createNew)result.issue='No existing owner found. A new owner and category row will be created with pending property details.';
  return result;
 });
 return {reportId:record.id,rows,applied:rows.filter(r=>r.state==='applied').length,pending:rows.filter(r=>r.state!=='applied').length};
}
export async function importOwnerSummaryReport(request:Request,env:AuthEnv,services:OwnerServices,user:AuthUser){
 try{
  const db=services.connect(env);
  if(request.method==='GET'){
   const offset=Number(new URL(request.url).searchParams.get('offset')||'0');if(!Number.isSafeInteger(offset)||offset<0||offset>100000)return fail('Invalid report page.');
   const reports=await db.query(`SELECT id,created_at AS "createdAt",entry_count AS total,entry_count-(SELECT count(*)::int FROM jsonb_object_keys(outcomes)) AS pending FROM owner_summary_reports WHERE ($1 OR created_by=$2) AND entry_count>(SELECT count(*) FROM jsonb_object_keys(outcomes)) ORDER BY updated_at DESC,id LIMIT 21 OFFSET $3`,[isAdmin(user),user.id,offset]);
   return json({success:true,data:{reports:reports.slice(0,20),nextOffset:reports.length>20?offset+20:null}});
  }
  if(request.method!=='POST')return fail('Method not allowed.',405);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>256000)return fail('Keep the report under 50,000 characters.',413);
  const body=JSON.parse(raw);if(!body||!['preview','commit'].includes(body.mode))return fail('Choose Preview report or Apply matched listings.');
  let record:StoredReport;
  if(body.reportId){
   if(typeof body.reportId!=='string'||!/^[a-f0-9]{64}$/.test(body.reportId))return fail('Invalid report ID.');
   record=(await db.query('SELECT * FROM owner_summary_reports WHERE id=$1',[body.reportId]))[0] as StoredReport;
   if(!record)return fail('Saved report not found.',404);
   if(!isAdmin(user)&&record.created_by!==user.id)return fail('Only the report creator or Admin can open this report.',403);
  }else{
   if(body.mode!=='preview'||typeof body.report!=='string')return fail('Paste a listing report first.');
   const text=body.report.replace(/\r\n/g,'\n').trim(),entries=parseReport(text);
   if(!entries.length)return fail('No listing entries found. Include WTL/WTS references and property details.');
   const id=await hash(user.id+'\n'+text);
   await db.query('INSERT INTO owner_summary_reports(id,created_by,report_text,entry_count) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',[id,user.id,text,entries.length]);
   record=(await db.query('SELECT * FROM owner_summary_reports WHERE id=$1',[id]))[0] as StoredReport;
  }
  if(body.mode==='preview')return json({success:true,data:await previewReport(record,env,services,user)});
  const choices=choicesInput(body.choices),original=parseReport(record.report_text);
  if(choices.some(c=>c.row>original.length))return fail('Report row not found.');
  const saved={...record.choices};for(const c of choices)if(!record.outcomes?.[c.row])saved[c.row]=c;
  const entries=applySummaryReferenceEdits(original,Object.values(saved)),owners=await readOwnerListings(db),prepared:any[]=[],selectedIds=new Set<number>();
  for(const choice of choices){
   if(body.saveOnly===true||choice.defer||(!choice.ownerId&&!choice.createNew)||record.outcomes?.[choice.row])continue;
   const entry=entries[choice.row-1],owner=owners.find(o=>o.id===choice.ownerId);
   if(entry.issues.length)return fail(`Row ${entry.row}: ${entry.issues.join(' ')}`);
   if(choice.createNew&&choice.ownerId)return fail('Choose either an existing owner or a new owner.');
   if(!owner&&!choice.createNew)return fail(`Row ${entry.row}: master owner listing not found.`,404);
   if(choice.createNew&&owners.some(o=>o.propertyName.toLowerCase().replace(/[^a-z0-9]/g,'')===entry.property.toLowerCase().replace(/[^a-z0-9]/g,'')||normalizeSummaryPhone(o.noTel)&&normalizeSummaryPhone(o.noTel)===normalizeSummaryPhone(entry.phone)))return fail('A possible owner already exists. Review the matches instead of creating a duplicate.',409);
   if(owner){
   if(!editable(owner,user))return fail('Only the assigned agent or Admin can update the selected listing.',403);
   if(owner.transactionType&&owner.transactionType!==entry.transactionType)return fail(`Row ${entry.row}: Rental/Subsale type conflicts with the master record.`);
   if(selectedIds.has(owner.id))return fail('Select each master property only once per apply.');selectedIds.add(owner.id);
   }
   const key=await hash(JSON.stringify([entry.reference,entry.date,normalizeSummaryPhone(entry.phone),entry.ownerName.toLowerCase().replace(/\s+/g,' ').trim(),entry.property.toLowerCase().replace(/\s+/g,' ').trim()]));
   prepared.push({row:entry.row,ownerId:owner?.id||null,createNew:!!choice.createNew,property:entry.property,version:choice.version,reference:entry.reference,date:entry.date,ownerName:entry.ownerName,phone:entry.phone,type:entry.transactionType,key});
  }
  if(body.saveOnly!==true&&!prepared.length&&!choices.some(c=>record.outcomes?.[c.row]))return fail('No ready listings were selected. Confirm an owner match or choose to create a missing owner, and resolve any row issues before applying.');
  if(!services.transact)throw new Error('Report transaction unavailable');
  const name=user.displayName||user.username,batch=crypto.randomUUID(),statements:{sql:string;params:any[]}[]=[
   {sql:"SET LOCAL lock_timeout='8s'",params:[]},
   {sql:'LOCK TABLE owner_listings IN SHARE ROW EXCLUSIVE MODE',params:[]},
   {sql:'LOCK TABLE listings IN SHARE ROW EXCLUSIVE MODE',params:[]},
   {sql:'SELECT id FROM owner_summary_reports WHERE id=$1 FOR UPDATE',params:[record.id]},
   {sql:`WITH input AS(SELECT * FROM jsonb_to_recordset($1::jsonb) AS i("ownerId" integer,version integer,reference text,type text,key text))
    SELECT 1/(CASE WHEN NOT EXISTS(SELECT 1 FROM input i LEFT JOIN owner_listings o ON o.id=i."ownerId" WHERE i."ownerId" IS NOT NULL AND (o.id IS NULL OR NOT ($2 OR coalesce(o.assigned_agent_id=$3,false)) OR
    (o.transaction_type IN ('rent','sale') AND o.transaction_type<>i.type) OR
    (o.version<>i.version AND NOT EXISTS(SELECT 1 FROM owner_listing_events e WHERE e.action='summary_report' AND e.listing_id=o.id AND e.after_record->>'summaryEntryKey'=i.key)) OR
    EXISTS(SELECT 1 FROM owner_listing_events e WHERE e.action='summary_report' AND e.after_record->>'reportReference'=i.reference AND e.listing_id<>o.id) OR
    EXISTS(SELECT 1 FROM listings l WHERE l.source_owner_listing_id=o.id AND l.project_category<>CASE i.type WHEN 'rent' THEN 'Rental' ELSE 'Subsale Direct Listing (SSDL)' END))) THEN 1 ELSE 0 END) AS valid`,params:[JSON.stringify(prepared),isAdmin(user),user.id]},
  ];
  for(const item of prepared){
   if(item.createNew){
    statements.push({sql:`SELECT 1/(CASE WHEN NOT EXISTS(SELECT 1 FROM owner_listing_events WHERE action='summary_report' AND after_record->>'reportReference'=$1 AND after_record->>'summaryEntryKey'<>$2) AND NOT EXISTS(SELECT 1 FROM owner_listings WHERE (lower(regexp_replace(property_name,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace($3,'[^a-zA-Z0-9]','','g')) OR regexp_replace(regexp_replace(no_tel,'[^0-9]','','g'),'^(0060|60)','0')=$4) AND NOT(coalesce(source='Summary report' AND listing_id=$1,false))) THEN 1 ELSE 0 END)`,params:[item.reference,item.key,item.property,normalizeSummaryPhone(item.phone)]});
    statements.push({sql:`WITH changed AS(INSERT INTO owner_listings(owner_name,no_tel,property_name,property_type,property_price,status,seeding_status,updated_by_name,transaction_type,source,listing_id)
     VALUES($1,$2,$3,'pending',NULL,'Listed','Contacted',$4,$5,'Summary report',$6) ON CONFLICT(source,listing_id) DO NOTHING RETURNING *)
     INSERT INTO owner_listing_events(listing_id,action,actor_id,actor_name,note,after_record) SELECT id,'create',$7,$4,'Created from report; property details pending',to_jsonb(changed) FROM changed`,params:[item.ownerName,item.phone,item.property,name,item.type,item.reference,user.id]});
   }
   // Both existing and newly created owners reuse a category imported from an ad report.
   const linkedOwner=`coalesce($3::int,(SELECT id FROM owner_listings WHERE source='Summary report' AND listing_id=$1))`;
   statements.push({sql:`SELECT 1/(CASE WHEN NOT EXISTS(SELECT 1 FROM listing_report_references r JOIN listings l ON l.id=r.listing_id WHERE r.reference=$1 AND (l.project_category<>$2 OR l.source_owner_listing_id IS NOT NULL AND l.source_owner_listing_id<>${linkedOwner} OR EXISTS(SELECT 1 FROM listings other WHERE other.source_owner_listing_id=${linkedOwner} AND other.id<>l.id))) THEN 1 ELSE 0 END)`,params:[item.reference,item.type==='rent'?'Rental':'Subsale Direct Listing (SSDL)',item.ownerId]});
   statements.push({sql:`WITH changed AS(UPDATE listings l SET source_owner_listing_id=${linkedOwner},version=l.version+1,updated_by_user_id=$4::text,updated_by_name=$5,last_updated_at=now() FROM listing_report_references r WHERE r.reference=$1 AND l.id=r.listing_id AND l.project_category=$2 AND l.source_owner_listing_id IS NULL RETURNING l.*)
    INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name) SELECT id,'owner_link',jsonb_build_object('after',to_jsonb(changed))::text,$4::text,$5 FROM changed`,params:[item.reference,item.type==='rent'?'Rental':'Subsale Direct Listing (SSDL)',item.ownerId,user.id,name]});
   const ownerId=item.createNew?`(SELECT id FROM owner_listings WHERE source='Summary report' AND listing_id=$12)`:'$1';
   statements.push({sql:`WITH old AS MATERIALIZED(SELECT * FROM owner_listings WHERE id=${ownerId} AND ($1::int IS NULL OR id=$1::int) FOR UPDATE),changed AS(
    UPDATE owner_listings l SET owner_name=$2,no_tel=$3,transaction_type=$4,status='Listed',seeding_status='Contacted',version=o.version+1,updated_by_name=$6,updated_at=now(),last_agent_activity_at=CASE WHEN o.assigned_agent_id=$5 THEN now() ELSE o.last_agent_activity_at END
    FROM old o WHERE l.id=o.id AND NOT EXISTS(SELECT 1 FROM owner_listing_events e WHERE e.action='summary_report' AND e.after_record->>'summaryEntryKey'=$7) RETURNING l.*),
    logged AS(INSERT INTO owner_listing_events(listing_id,action,actor_id,actor_name,note,before_record,after_record)
    SELECT c.id,'summary_report',$5,$6,'Listing report: '||$8,to_jsonb(o),to_jsonb(c)||jsonb_build_object('summaryEntryKey',$7::text,'reportReference',$8::text,'reportDate',$9::text,'reportId',$10::text,'batchId',$11::text) FROM changed c JOIN old o ON o.id=c.id)
    ${ownerPromotionCtes('$5','$6',false)} SELECT id FROM changed`,params:[item.ownerId,item.ownerName,item.phone,item.type,user.id,name,item.key,item.reference,item.date,record.id,batch,...(item.createNew?[item.reference]:[])]});
   const information=`Listing report\nReference: ${item.reference}\nReport date: ${item.date}\nOwner: ${item.ownerName}\nContact: ${item.phone}`,marker=information;
   const resolvedId=item.createNew?`(SELECT id FROM owner_listings WHERE source='Summary report' AND listing_id=$10)`:'$1';
   statements.push({sql:`WITH old AS MATERIALIZED(SELECT * FROM listings WHERE source_owner_listing_id=${resolvedId} AND ($1::int IS NULL OR source_owner_listing_id=$1::int) FOR UPDATE),changed AS(
    UPDATE listings l SET agent=$2,no_tel=$3,notes=CASE WHEN strpos(coalesce(l.notes,''),$4)>0 THEN l.notes ELSE concat_ws(E'\n\n',nullif(l.notes,''),$5::text) END,
    version=l.version+1,updated_by_user_id=$6::text,updated_by_name=$7,last_updated_at=now() FROM old o WHERE l.id=o.id AND EXISTS(SELECT 1 FROM owner_listing_events e WHERE e.listing_id=${resolvedId} AND e.action='summary_report' AND e.after_record->>'summaryEntryKey'=$8 AND e.after_record->>'batchId'=$9) RETURNING l.*),
    logged AS(INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name)
    SELECT c.id,'summary_report',jsonb_build_object('before',to_jsonb(o),'after',to_jsonb(c))::text,$6::text,$7 FROM changed c JOIN old o ON c.id=o.id) SELECT id FROM changed`,params:[item.ownerId,item.ownerName,item.phone,marker,information,user.id,name,item.key,batch,...(item.createNew?[item.reference]:[])]});
   const outcomeId=item.createNew?`(SELECT id FROM owner_listings WHERE source='Summary report' AND listing_id=$5)`:'$3::int';
   statements.push({sql:`UPDATE owner_summary_reports SET outcomes=jsonb_set(outcomes,ARRAY[$2::text],jsonb_build_object('ownerId',${outcomeId},'entryKey',$4::text,'reference',$5::text,'date',$6::text)),updated_at=now() WHERE id=$1 AND ($3::int IS NULL OR $3::int=${outcomeId}) AND EXISTS(SELECT 1 FROM owner_listing_events WHERE action='summary_report' AND listing_id=${outcomeId} AND after_record->>'summaryEntryKey'=$4) RETURNING id`,params:[record.id,String(item.row),item.ownerId,item.key,item.reference,item.date]});
  }
  const delta=Object.fromEntries(choices.filter(c=>!record.outcomes?.[c.row]).map(c=>[c.row,c]));
  statements.push({sql:'UPDATE owner_summary_reports SET choices=choices||$2::jsonb,updated_at=now() WHERE id=$1 RETURNING id',params:[record.id,JSON.stringify(delta)]});
  try{await services.transact(env,statements);}catch(error:any){if(['22012','55P03','40P01','40001'].includes(error?.code))return fail('A selected listing changed, its category conflicts, or its reference is already used. Reopen the report and review the latest matches before applying.',409);throw error;}
  const updated=(await db.query('SELECT * FROM owner_summary_reports WHERE id=$1',[record.id]))[0] as StoredReport;
  return json({success:true,data:await previewReport(updated,env,services,user)});
 }catch(error){
  if(error instanceof SyntaxError)return fail('Invalid report request.');
  if(error instanceof SummaryInputError)return fail(error.message);
  return fail('Unable to import the listing report. Your report is saved; please retry.',500);
 }
}
