import {workflowChannels,type WorkflowContext,type WorkflowListing} from '../../workflow/model';
import type {WorkflowDb} from './database';
export interface LinkChoices {ownerId?:number;listingId?:number;newOwner?:boolean;newListing?:boolean;category?:string}
export class WorkflowSyncError extends Error {constructor(message:string,public status=409,public details?:Record<string,unknown>){super(message);}}
const identity=(v:unknown)=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const phone=(v:unknown)=>{const n=String(v||'').replace(/\D/g,'');return n.startsWith('60')?'0'+n.slice(2):n;};
const known=(v:unknown)=>!!String(v||'').trim()&&!/^(?:-|pending(?: details)?|not (?:provided|captured)|unknown|location not provided)$/i.test(String(v).trim());
const sameContact=(a:unknown,b:unknown)=>!!phone(a)&&!!phone(b)&&phone(a)===phone(b);
const categories=['Project Marketing (PM)','Rental','Subsale CoA (SSCOA)','Subsale Direct Listing (SSDL)','Million Dollar Property (MD)','Auction'];
function money(v:string){const m=v.replace(/RM|MYR/ig,'').replace(/,/g,'').trim().match(/^(\d+(?:\.\d{1,2})?)\s*(k|m|million)?(?:\s+(?:negotiable|nego))?$/i);return m?Number(m[1])*(m[2]?.toLowerCase()==='k'?1000:m[2]?1000000:1):null;}
function choose(rows:any[],strong:any[],id:number|undefined,allowNew:boolean|undefined,label:string){
 if(id!==undefined&&(!Number.isSafeInteger(id)||id<1))throw new WorkflowSyncError(`Choose a valid ${label} record.`);
 if(strong.length>1)throw new WorkflowSyncError(`This reference or source is linked to multiple ${label} records. Resolve the conflicting references first.`);
 if(strong.length){if(id&&id!==strong[0].id||allowNew)throw new WorkflowSyncError(`The reference already belongs to ${label} #${strong[0].id}.`);return strong[0];}
 if(id){const picked=rows.find(r=>r.id===id);if(!picked)throw new WorkflowSyncError(`Choose one of the matching ${label} records.`);return picked;}
 if(allowNew)return undefined;
 return undefined;
}
function conflict(owners:any[],listings:any[]){return new WorkflowSyncError('Possible matches need review. Choose the correct existing records, or confirm this is a different property.',409,{matches:{owners:owners.map(o=>({id:o.id,property:o.property_name,contact:o.no_tel,name:o.owner_name})),listings:listings.map(l=>({id:l.id,property:l.property,category:l.project_category,contact:l.no_tel}))}});}
async function patch(db:WorkflowDb,table:'owner_listings'|'listings',row:any,values:Record<string,unknown>,context:WorkflowContext){
 const changes=Object.entries(values).filter(([k,v])=>v!==undefined&&JSON.stringify(row[k]??null)!==JSON.stringify(v??null));
 if(!changes.length)return row;
 const params:any[]=changes.map(([,v])=>v);params.push(context.effective.name,context.effective.id,row.id);
 const sets=changes.map(([k],i)=>`${k}=$${i+1}`);
 if(table==='owner_listings')sets.push(`updated_by_name=$${params.length-2}`,`updated_at=now()`);
 else sets.push(`updated_by_name=$${params.length-2}`,`updated_by_user_id=$${params.length-1}::text`,`last_updated_at=now()`);
 // Both statements reference the actor ID so the parameter list remains contiguous.
 const after=(await db.query(`UPDATE ${table} SET ${sets.join(',')},version=version+1 WHERE id=$${params.length} AND $${params.length-1}::int>0 RETURNING *`,params))[0];
 await audit(db,table,row,after,context);return after;
}
async function audit(db:WorkflowDb,table:string,before:any,after:any,context:WorkflowContext){
 const payload={before,after,actualUserId:context.actual.id,actualName:context.actual.name,effectiveUserId:context.effective.id};
 if(table==='owner_listings')await db.query("INSERT INTO owner_listing_events(listing_id,action,actor_id,actor_name,note,before_record,after_record) VALUES($1,'marketing_workflow',$2,$3,$4,$5::jsonb,$6::jsonb)",[after.id,context.effective.id,context.effective.name,`Workflow update; signed in as ${context.actual.name}`,JSON.stringify(before),JSON.stringify(after)]);
 else await db.query("INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name) VALUES($1,'marketing_workflow',$2,$3,$4)",[after.id,JSON.stringify(payload),String(context.effective.id),context.effective.name]);
}
function workflowInformation(w:WorkflowListing){
 const b=w.brief,approved=w.materials.filter(m=>!m.replacedBy&&!m.archivedAt&&!m.original&&m.review==='approved');
 const complete=w.destinations.flatMap(d=>d.publications.length?[`${workflowChannels.find(c=>c.id===d.channelId)?.name}: ${d.publications[0].url||'Done'}`]:[]);
 return [`Reference: ${b.reference}`,b.ownerName&&`Owner: ${b.ownerName}`,b.phone&&`Contact: ${b.phone}`,b.price&&`Price: ${b.price}`,b.sourceUrl&&`Original listing: ${b.sourceUrl}`,b.whatsapp&&`Owner WhatsApp: ${b.whatsapp}`,b.details,b.raw&&`Owner briefing:\n${b.raw}`,approved.length&&'Approved materials:',...approved.map(m=>m.kind==='copy'?`${m.title} (v${m.revision}):\n${m.text}`:`${m.title} (v${m.revision}): /api/workflow/files/${m.fileKey}`),...complete].filter(Boolean).join('\n');
}
function withInformation(notes:string|null,w:WorkflowListing){
 const start=`[Marketing workflow ${w.id}]`,end='[/Marketing workflow]',block=`${start}\n${workflowInformation(w)}\n${end}`;
 const text=notes||'',offset=text.indexOf(start),finish=offset>=0?text.indexOf(end,offset):-1;
 return offset>=0&&finish>=0?text.slice(0,offset)+block+text.slice(finish+end.length):[text,block].filter(Boolean).join('\n\n');
}
export async function syncWorkflow(db:WorkflowDb,w:WorkflowListing,previous:WorkflowListing|null,context:WorkflowContext,choices:LinkChoices={}){
 const b=w.brief,changed=(key:keyof typeof b)=>!previous||JSON.stringify(b[key])!==JSON.stringify(previous.brief[key]);
 let category=b.category==='Rental'?'Rental':b.category==='Subsale'?'Subsale Direct Listing (SSDL)':previous?.links?.category||choices.category||'';
 if(!categories.includes(category))throw new WorkflowSyncError('Choose the corresponding listing category for this workflow.',400,{chooseCategory:true});
 if(previous&&category!==previous.links?.category)throw new WorkflowSyncError('This workflow is linked to a different listing category. Keep its current category.');
 if((b.reference.startsWith('WTL-')&&category!=='Rental')||(b.reference.startsWith('WTS-')&&category==='Rental'))throw new WorkflowSyncError('The reference and Rental/Subsale category conflict.');
 let owner:any,listing:any;
 if(previous){
  owner=(await db.query('SELECT * FROM owner_listings WHERE id=$1',[previous.links!.ownerId]))[0];
  if(!owner)throw new WorkflowSyncError('The linked owner record was deleted. Restore it before continuing.');
  listing=previous.links?.listingId?(await db.query('SELECT * FROM listings WHERE id=$1',[previous.links.listingId]))[0]:undefined;
  if(previous.links?.listingId&&!listing)throw new WorkflowSyncError('The linked category listing was deleted. Restore it before continuing.');
 }else{
  const owners=await db.query('SELECT * FROM owner_listings'),listings=await db.query('SELECT * FROM listings');
  const refs=await db.query("SELECT listing_id FROM listing_report_references WHERE reference=$1 UNION SELECT l.id FROM listings l JOIN owner_listing_events e ON e.listing_id=l.source_owner_listing_id WHERE e.action='summary_report' AND e.after_record->>'reportReference'=$1",[b.reference]);
  const ownerRefs=await db.query("SELECT DISTINCT listing_id FROM owner_listing_events WHERE action='summary_report' AND after_record->>'reportReference'=$1",[b.reference]);
  const refListings=listings.filter(l=>refs.some(r=>Number(r.listing_id)===l.id));
  const refOwners=owners.filter(o=>ownerRefs.some(r=>Number(r.listing_id)===o.id)||refListings.some(l=>l.source_owner_listing_id===o.id));
  const sourceOwners=known(b.sourceUrl)?owners.filter(o=>o.property_link?.replace(/\/$/,'')===b.sourceUrl.replace(/\/$/,'')):[];
  const ownerMatches=owners.filter(o=>identity(o.property_name)===identity(b.property)||sourceOwners.includes(o)||phone(b.phone)&&phone(o.no_tel)===phone(b.phone));
  const exactOwners=ownerMatches.filter(o=>identity(o.property_name)===identity(b.property)&&sameContact(o.no_tel,b.phone));
  const strongOwners=[...new Map([...refOwners,...sourceOwners].map(o=>[o.id,o])).values()];
  const listMatches=listings.filter(l=>identity(l.property)===identity(b.property)||refListings.includes(l));
  owner=choose(ownerMatches,strongOwners,choices.ownerId,choices.newOwner,'owner');
  if(!owner&&!choices.newOwner&&exactOwners.length===1)owner=exactOwners[0];
  if(!owner&&!choices.newOwner&&ownerMatches.length)throw conflict(ownerMatches,listMatches);
  if(choices.newOwner&&exactOwners.some(o=>phone(b.phone)&&phone(o.no_tel)===phone(b.phone)))throw conflict(ownerMatches,listMatches);
  const linked=owner?listings.filter(l=>l.source_owner_listing_id===owner.id):[];
  const strongListings=[...new Map([...refListings,...linked].map(l=>[l.id,l])).values()];
  listing=choose([...new Map([...listMatches,...strongListings].map(l=>[l.id,l])).values()],strongListings,choices.listingId,choices.newListing,'category listing');
  const exactListings=listMatches.filter(l=>sameContact(l.no_tel,b.phone)&&(!l.source_owner_listing_id||l.source_owner_listing_id===owner?.id));
  if(!listing&&!choices.newListing&&exactListings.length===1)listing=exactListings[0];
  if(!listing&&!choices.newListing&&listMatches.length)throw conflict(ownerMatches,listMatches);
  if(choices.newListing&&exactListings.some(l=>phone(b.phone)&&phone(l.no_tel)===phone(b.phone)))throw conflict(ownerMatches,listMatches);
  if(listing?.source_owner_listing_id){if(owner&&owner.id!==listing.source_owner_listing_id)throw conflict(ownerMatches,listMatches);owner=owners.find(o=>o.id===listing.source_owner_listing_id);if(!owner)throw new WorkflowSyncError('The category row points to a missing owner. Resolve that link first.');}
  const existing=await db.query('SELECT id FROM marketing_workflows WHERE owner_listing_id=$1 OR listing_id=$2',[owner?.id||null,listing?.id||null]);
  if(existing.length)throw new WorkflowSyncError('This listing already has a workflow. Open the linked workflow instead.',409,{workflowId:existing[0].id});
 }
 if(listing&&listing.project_category!==category)throw new WorkflowSyncError('The matching category listing has a different category. Review its reference and Rental/Subsale type.');
 const transactionType=category==='Rental'?'rent':b.category==='Subsale'?'sale':null;
 if(owner?.transaction_type&&transactionType&&owner.transaction_type!==transactionType)throw new WorkflowSyncError('The owner record has a different Rental/Subsale type. Review the matched property.');
 const permissionChanged=changed('permission'),price=money(b.price);
 if(!owner){
  owner=(await db.query("INSERT INTO owner_listings(owner_name,no_tel,property_name,property_link,property_type,property_price,status,updated_by_name,transaction_type,location,seeding_status,source) VALUES($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,'marketing_workflow') RETURNING *",[b.ownerName||'Pending details',b.phone||'Pending details',b.property,b.sourceUrl,price,b.permission?'Listed':'Unlisted',context.effective.name,transactionType,b.location||null,b.permission?'Contacted':null]))[0];
  await audit(db,'owner_listings',null,owner,context);
 }else{
  const values:Record<string,unknown>={};
  for(const [key,column] of [['property','property_name'],['ownerName','owner_name'],['phone','no_tel'],['sourceUrl','property_link'],['location','location']] as const)if(changed(key)&&known(b[key]))values[column]=b[key];
  if(changed('price')&&price!==null)values.property_price=price.toFixed(2);
  if(!owner.transaction_type&&transactionType)values.transaction_type=transactionType;
  if(permissionChanged&&(b.permission||previous)){values.status=b.permission?'Listed':'Unlisted';if(b.permission)values.seeding_status='Contacted';}
  owner=await patch(db,'owner_listings',owner,values,context);
 }
 if(!listing){listing=(await db.query('SELECT * FROM listings WHERE source_owner_listing_id=$1',[owner.id]))[0];if(listing&&listing.project_category!==category)throw new WorkflowSyncError('The linked owner already belongs to a different category listing.');}
 if(!listing&&b.permission){
  listing=(await db.query("INSERT INTO listings(source_owner_listing_id,property,project_category,location,tenure,pm,agent,no_tel,available_units,asking_price,status,date,renew_status,notes,created_by_user_id,created_by_name,updated_by_user_id,updated_by_name) VALUES($1,$2,$3,$4,$5,'-',$6,$7,'-',$10::numeric,'Pending','','Not Renewed','',$8,$9,$8,$9) RETURNING *",[owner.id,b.property,category,b.location||owner.location||'Pending details',owner.tenure||'-',b.ownerName||owner.owner_name,b.phone||owner.no_tel,String(context.effective.id),context.effective.name,price]))[0];
  await audit(db,'listings',null,listing,context);
 }
 w.links={ownerId:owner.id,listingId:listing?.id||null,category,syncedAt:new Date().toISOString()};
 if(listing){
  const values:Record<string,unknown>={source_owner_listing_id:owner.id};
  for(const [key,column] of [['property','property'],['ownerName','agent'],['phone','no_tel'],['location','location']] as const)if(changed(key)&&known(b[key]))values[column]=b[key];
  if(changed('price')&&price!==null)values.asking_price=price.toFixed(2);
  if(permissionChanged&&b.permission){values.archived_at=null;values.archived_by_name=null;}
  if(previous&&permissionChanged&&!b.permission&&!listing.archived_at){values.archived_at=new Date().toISOString();values.archived_by_name=context.effective.name;}
  values.notes=withInformation(listing.notes,w);
  listing=await patch(db,'listings',listing,values,context);
  await db.query('INSERT INTO listing_report_references(reference,listing_id) VALUES($1,$2) ON CONFLICT(reference) DO NOTHING',[b.reference,listing.id]);
  const linked=(await db.query('SELECT listing_id FROM listing_report_references WHERE reference=$1',[b.reference]))[0];
  if(linked.listing_id!==listing.id)throw new WorkflowSyncError('The reference belongs to another listing.');
  for(const d of w.destinations){const channel=workflowChannels.find(c=>c.id===d.channelId)!;for(const p of d.publications){
   if(!p.url||previous?.destinations.some(old=>old.publications.some(pub=>pub.id===p.id)))continue;
   if((await db.query('SELECT id FROM listing_publications WHERE listing_id=$1 AND url=$2',[listing.id,p.url])).length)continue;
   const channels=await db.query('SELECT id FROM publication_channels WHERE lower(trim(name))=lower(trim($1)) AND archived_at IS NULL',[channel.name]);
   const channelId=channels[0]?.id||(await db.query('INSERT INTO publication_channels(name) VALUES($1) ON CONFLICT (lower(trim(name))) DO UPDATE SET archived_at=NULL RETURNING id',[channel.name]))[0].id;
   const publication=(await db.query('INSERT INTO listing_publications(listing_id,channel_id,url,label,notes) VALUES($1,$2,$3,$4,$5) RETURNING *',[listing.id,channelId,p.url,channel.name,p.note||null]))[0];
   await db.query("INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name) VALUES($1,'advertisement_create',$2,$3,$4)",[listing.id,JSON.stringify({after:publication,workflowId:w.id,actualName:context.actual.name}),String(context.effective.id),context.effective.name]);
  }}
 }
}
