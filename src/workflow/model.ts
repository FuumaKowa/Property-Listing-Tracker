import {applyProduction,invalidateProduction,productionActive,type ProductionJob,type ProductionAction} from './production';
export type WorkflowRole = 'super_admin' | 'coordinator' | 'producer' | 'reviewer' | 'publisher' | 'viewer';
export interface WorkflowUser { id:number; name:string; role:WorkflowRole }
export interface WorkflowContext { actual:WorkflowUser; effective:WorkflowUser; productionWorker?:boolean }
export type MaterialKind = 'photo' | 'poster' | 'video' | 'copy';
export interface Brief {
  reference:string; property:string; location:string; category:'Rental'|'Subsale'|'Other';
  ownerName:string; phone:string; whatsapp:string; sourceUrl:string; price:string;
  details:string; raw:string; permission:boolean; tasks:{id:string;label:string;done:boolean}[];
}
export interface Material {
  id:string; kind:MaterialKind; title:string; revision:number; original:boolean;
  fileKey?:string; mime?:string; text?:string; replacesId?:string; replacedBy?:string; productionId?:string; archivedAt?:string; archivedBy?:string;
  review:'draft'|'submitted'|'approved'|'changes'; note:string; at:string; by:string;
}
export interface Destination {
  channelId:string;
  approval:{id:string;materialIds:string[];at:string;by:string}|null;
  blocked:string;
  publications:{id:string;approvalId:string;url:string;note:string;at:string;by:string}[];
}
export interface WorkflowEvent {id:string;at:string;actualName:string;effectiveName:string;message:string}
export interface WorkflowListing {
  id:string; version:number; brief:Brief; handedOffAt:string|null; createdAt:string; updatedAt:string;
  assignees:Record<'coordinator'|'producer'|'reviewer'|'publisher',number>;
  materials:Material[]; destinations:Destination[]; events:WorkflowEvent[];
  destinationSelectionSaved?:boolean; production?:ProductionJob;
  links?:{ownerId:number;listingId:number|null;category:string;syncedAt:string};
  sentReports:{at:string;by:string;signature:string;text:string;final:boolean}[];
}
export interface Channel {id:string;name:string;completion:'link'|'done';video:boolean}
const channelRows:[string,string,'link'|'done',boolean?][]=[
  ['telegram-subsale','Telegram Channel Nhc Coa Listing Subsale','link'],
  ['telegram-project','Telegram Channel Nhc Coa Listing New Project','link'],
  ['telegram-auction','Telegram Channel Nhc Auction Listing','link'],
  ['telegram-group','Telegram Group Nhc Subsale','link'],
  ['mgn-main','Telegram Group Mgn Main','link'],['mgn-locality','Telegram Group Mgn Locality','link'],
  ['propertyguru','Propguru','link'],['iproperty','Iprop','link'],['propmall','Propmall','link'],['mudah','Mudah','link'],
  ['facebook-page','Facebook Page Rumahlot','link'],['facebook-new','Facebook Page Rumahbaru','link'],
  ['facebook-auction','Facebook Page Rumahlelong','link'],['facebook-profile','Facebook Profile Rumahlot','link'],
  ['facebook-marketplace','Facebook Marketplace Rumahlot','link'],['instagram','Instagram Rumahlot','link'],
  ['threads','Threads','link'],['tiktok','TikTok','link',true],['website','Nhc Website','link'],
  ['whatsapp-nhc','Whatsapp Nhc Broadcast HotListing Locality','done'],['whatsapp-coa','Whatsapp Coa Hot Listing Locality','done'],
  ['ibilik','Ibilik','link'],['speedhome','Speedhome','link'],['carousell','Carousell','link'],
];
export const workflowChannels:Channel[]=channelRows.map(([id,name,completion,video])=>({id,name,completion,video:!!video}));
export const workflowStages=['Briefing','Production','Publishing','Owner update','Owner informed','On hold'] as const;
export type WorkflowStage=typeof workflowStages[number];
export type WorkflowAction = ProductionAction
  | {type:'saveBrief';brief:Brief}
  | {type:'handoff'}
  | {type:'addMaterial';kind:MaterialKind;title:string;text?:string;fileKey?:string;mime?:string;original?:boolean;generated?:boolean;replacesId?:string}
  | {type:'addGeneratedCopy';title:string;text:string;replacesId?:string}
  | {type:'removeMaterial';id:string}
  | {type:'submit';ids:string[]}
  | {type:'review';ids:string[];approved:boolean;note?:string}
  | {type:'addDestination'|'removeDestination';channelId:string}
  | {type:'setDestinations';channelIds:string[]}
  | {type:'approveForPublishing';channelIds:string[];materialIds:string[]}
  | {type:'approveDestination';channelId:string;materialIds:string[]}
  | {type:'publish';channelId:string;url?:string;note?:string}
  | {type:'block';channelId:string;note:string}
  | {type:'sent'};

const uid=()=>globalThis.crypto.randomUUID();
function requireThat(condition:unknown,message:string):asserts condition {if(!condition)throw new Error(message);}
function value(input:unknown,label:string,max=500,required=false):string {
  requireThat(typeof input==='string'&&input.trim().length<=max,`${label} is invalid or too long.`);
  const result=input.trim();requireThat(!required||result,`${label} is required.`);return result;
}
export function httpUrl(input:string,required=false):string {
  if(!input.trim()&&!required)return '';
  let u:URL;try{u=new URL(input);}catch{throw new Error('Enter a complete http or https URL.');}
  requireThat(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&input.length<=2048,'Enter a valid http or https URL.');
  return u.href;
}
export function validateBrief(input:Brief):Brief {
  requireThat(input&&typeof input==='object','Enter a listing brief.');
  const result:Brief={reference:value(input.reference,'Reference',80,true).toUpperCase(),property:value(input.property,'Property',300,true),location:value(input.location,'Location',300),category:input.category,ownerName:value(input.ownerName,'Owner name',200),phone:value(input.phone,'Contact',60),whatsapp:httpUrl(value(input.whatsapp,'WhatsApp',2048)),sourceUrl:httpUrl(value(input.sourceUrl,'Original listing',2048)),price:value(input.price,'Price',80),details:value(input.details,'Property details',20000),raw:value(input.raw,'Original report',50000),permission:input.permission===true,tasks:[]};
  requireThat(/^[A-Z0-9][A-Z0-9/-]*$/.test(result.reference),'Enter a valid unique reference.');
  requireThat(['Rental','Subsale','Other'].includes(result.category),'Select Rental, Subsale or Other.');
  requireThat(Array.isArray(input.tasks)&&input.tasks.length<=30,'Use at most 30 required checks.');
  result.tasks=input.tasks.map(t=>({id:value(t.id,'Check ID',80,true),label:value(t.label,'Required check',300,true),done:t.done===true}));
  requireThat(new Set(result.tasks.map(t=>t.id)).size===result.tasks.length,'Required check IDs must be unique.');
  return result;
}
export function parseBrief(raw:string):Brief {
  requireThat(typeof raw==='string'&&raw.length<=50000,'Keep the briefing under 50,000 characters.');
  const lines=raw.replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').split(/\r?\n/).map(l=>l.replace(/^[*•\s-]+|[*\s]+$/g,'').trim());
  const field=(key:string)=>lines.map(l=>new RegExp('^(?:'+key+')\\s*:\\s*(.+)$','i').exec(l)?.[1]||'').find(Boolean)||'';
  const reference=field('REF|REFERENCE').toUpperCase();
  const taskStart=lines.findIndex(l=>/^(?:📌\s*)?TASKS?$/i.test(l));
  const tasks:string[]=[];
  if(taskStart>=0)for(const line of lines.slice(taskStart+1)){if(/^(?:📌|🔗|👤|🏞)|^(?:STATUS|OWNER|PROPERTY DETAILS)\b/i.test(line))break;if(line&&!/^(?:prepare\b.*(?:copywriting|marketing materials|poster|video|pictures)|submit draft for review\b)/i.test(line))tasks.push(line);}
  const source=lines.find(l=>/^https?:\/\//i.test(l)&&!/^https?:\/\/(?:wa\.me|api\.whatsapp\.com)/i.test(l))||'';
  return {reference,property:field('Property'),location:field('Location'),category:reference.startsWith('WTL')?'Rental':reference.startsWith('WTS')?'Subsale':'Other',ownerName:field('Contact Name|Name'),phone:field('Contact|Phone'),whatsapp:field('WhatsApp'),sourceUrl:source,price:field('Asking Price|Price'),details:lines.filter(l=>/^(?:Land Area|Built.up|Tenure|Lot Status|Land Grant|Property Category|Existing Oil Palm Trees|Bedrooms|Bathrooms)\s*:/i.test(l)).join('\n'),raw,permission:false,tasks:tasks.slice(0,30).map(label=>({id:uid(),label,done:false}))};
}
export function canWork(user:WorkflowUser,w:WorkflowListing,role:keyof WorkflowListing['assignees']):boolean {
  return user.role==='super_admin'||user.id===w.assignees[role];
}
export function currentPublication(d:Destination){return d.approval?d.publications.find(p=>p.approvalId===d.approval!.id):undefined;}
export function publicationPackage(channelId:string,materials:Material[]):Material[]{
  const channel=workflowChannels.find(c=>c.id===channelId);
  if(!channel)return [];
  const copies=materials.filter(m=>m.kind==='copy');
  const visuals=materials.filter(m=>channel.video?m.kind==='video':['photo','poster','video'].includes(m.kind));
  return copies.length&&visuals.length?[...copies,...visuals]:[];
}
export function allPublished(w:WorkflowListing){return w.brief.permission&&w.destinations.length>0&&w.destinations.every(d=>!!currentPublication(d)&&!d.blocked);}
export function needsWorkflowReview(w:WorkflowListing){
  return false;
}
export function reportSignature(w:WorkflowListing){return JSON.stringify({brief:w.brief,destinations:w.destinations.map(d=>({id:d.channelId,approval:d.approval?.id,publication:currentPublication(d)?.id,blocked:d.blocked}))});}
export function workflowStage(w:WorkflowListing):WorkflowStage {
  if(!w.brief.permission)return w.handedOffAt?'On hold':'Briefing';
  if(!w.handedOffAt)return 'Briefing';
  if(productionActive(w))return 'Production';
  if(w.production&&['failed','cancelled'].includes(w.production.status))return 'On hold';
  if(allPublished(w))return w.sentReports.some(r=>r.final&&r.signature===reportSignature(w))?'Owner informed':'Owner update';
  if(w.destinations.some(d=>d.approval||d.publications.length))return 'Publishing';
  if(w.materials.some(m=>!m.replacedBy&&!m.archivedAt&&!m.original&&['submitted','approved'].includes(m.review)))return 'Publishing';
  return 'Production';
}
export function ownerReport(w:WorkflowListing):string {
  const heading=`*FOR ${w.brief.category==='Rental'?'RENT':w.brief.category==='Subsale'?'SALE':'MARKETING'} | ${w.brief.property}${w.brief.price?' • '+w.brief.price:''}*`;
  const prefix=allPublished(w)?'PUBLICATION REPORT':'INTERIM PUBLICATION REPORT';
  const rows=workflowChannels.map((c,i)=>{
    const d=w.destinations.find(d=>d.channelId===c.id);if(!d)return `${i+1}. ${c.name} : N/A`;
    const p=currentPublication(d);
    const status=d.blocked?'Pending':p?(c.completion==='done'?'Done':p.url):d.approval?'Pending publication':'Pending materials';
    return `${i+1}. ${c.name} : ${status}`;
  });
  return [prefix,heading,`REF: ${w.brief.reference}`,'👤 OWNER / ADVERTISER',`* Name: ${w.brief.ownerName||'Pending'}`,`* Contact: ${w.brief.phone||'Pending'}`,'',...rows].join('\n');
}
export function createWorkflow(brief:Brief,context:WorkflowContext):WorkflowListing {
  requireThat(['super_admin','coordinator'].includes(context.effective.role),'Only the coordinator or SuperAdmin can create a workflow.');
  const now=new Date().toISOString();
  return {id:uid(),version:1,brief:validateBrief(brief),handedOffAt:null,createdAt:now,updatedAt:now,assignees:{coordinator:2,producer:3,reviewer:4,publisher:5},materials:[],destinations:[],sentReports:[],events:[{id:uid(),at:now,actualName:context.actual.name,effectiveName:context.effective.name,message:'Created listing workflow'}]};
}
export function applyWorkflowAction(source:WorkflowListing,action:WorkflowAction,context:WorkflowContext):WorkflowListing {
  const w=structuredClone(source),now=new Date().toISOString();let message='';
  const permit=(role:keyof WorkflowListing['assignees'])=>requireThat(canWork(context.effective,w,role),`You do not have permission for this ${role} action.`);
  const destination=(id:string)=>{const d=w.destinations.find(d=>d.channelId===id);requireThat(d,'Select a planned destination.');return d;};
  const materials=(ids:string[])=>{requireThat(Array.isArray(ids)&&ids.length>0&&ids.length<=100&&new Set(ids).size===ids.length,'Select at least one unique material.');return ids.map(id=>{const m=w.materials.find(m=>m.id===id);requireThat(m&&!m.replacedBy&&!m.archivedAt&&!m.original,'Select current prepared materials.');return m;});};
  const invalidate=(ids?:string[])=>{for(const d of w.destinations)if(d.approval&&(!ids||d.approval.materialIds.some(id=>ids.includes(id))))d.approval=null;};
  const setDestinations=(channelIds:string[])=>{
    requireThat(Array.isArray(channelIds)&&channelIds.length<=workflowChannels.length&&new Set(channelIds).size===channelIds.length,'Select unique publishing destinations.');
    requireThat(channelIds.every(id=>workflowChannels.some(c=>c.id===id)),'Choose valid publication channels.');
    requireThat(w.destinations.every(d=>!d.publications.length||channelIds.includes(d.channelId)),'Published destinations must stay selected to preserve their history.');
    const existing=w.destinations;w.destinations=channelIds.map(channelId=>existing.find(d=>d.channelId===channelId)||{channelId,approval:null,blocked:'',publications:[]});w.destinationSelectionSaved=true;
  };
  requireThat(action&&typeof action==='object','Choose a workflow action.');
  if(productionActive(w)&&!['productionWorker','cancelProduction','saveBrief'].includes(action.type)&&!(action.type==='addMaterial'&&action.original))throw new Error('Cancel automatic production before making manual production or publishing changes.');
  switch(action.type){
    case 'startProduction':case 'cancelProduction':case 'manualProduction':case 'productionWorker':
      message=applyProduction(w,action,context,now);break;
    case 'saveBrief':{
      permit('coordinator');const next=validateBrief(action.brief);
      const before={...w.brief,tasks:[],raw:''},after={...next,tasks:[],raw:''};
      if(JSON.stringify(before)!==JSON.stringify(after)||next.tasks.some(t=>!t.done))invalidate();
      w.brief=next;message='Updated owner brief and required checks';break;
    }
    case 'handoff':
      permit('coordinator');requireThat(!w.handedOffAt,'This brief has already been handed off.');
      requireThat(w.brief.permission,'Confirm owner permission before handing off.');
      requireThat(w.brief.location&&w.brief.ownerName&&w.brief.phone,'Fill in location, owner name and contact before handing off.');
      w.handedOffAt=now;message='Sent owner brief to Luqman for production';break;
    case 'addMaterial':{
      const generated=action.generated===true;
      if(action.original)requireThat(canWork(context.effective,w,'coordinator')||canWork(context.effective,w,'producer'),'Only the coordinator or producer can upload original materials.');else if(generated){permit('coordinator');requireThat(w.brief.permission&&w.handedOffAt,'Confirm owner permission and hand off the brief before generating materials.');requireThat(action.kind==='poster'&&action.fileKey,'Only a rendered poster file can use the generated material upload.');}else permit('producer');
      requireThat(action.original||w.handedOffAt,'Send the brief to production first.');
      requireThat(['photo','poster','video','copy'].includes(action.kind),'Choose a valid material type.');
      const title=value(action.title,'Material title',200,true),text=action.kind==='copy'?value(action.text,'Copywriting',20000,true):undefined;
      requireThat(action.kind==='copy'||(typeof action.fileKey==='string'&&action.fileKey.length>0),'Upload a file for this material.');
      const old=action.replacesId?w.materials.find(m=>m.id===action.replacesId):undefined;
      if(action.replacesId)requireThat(old&&!old.replacedBy&&!old.archivedAt&&old.kind===action.kind&&old.original===!!action.original,'Replace the current version of the same material type.');
      const id=uid();if(old){old.replacedBy=id;invalidate([old.id]);}
      w.materials.push({id,kind:action.kind,title,revision:(old?.revision||0)+1,original:!!action.original,fileKey:action.fileKey,mime:action.mime,text,replacesId:old?.id,review:generated?'approved':'draft',note:generated?'Generated in the browser from supplied listing facts and photos; automatically released to Muz.':'',at:now,by:generated?'Automation':context.effective.name});
      message=`${old?'Revised':'Added'} ${action.kind}: ${title}${old?' (affected publishing packages need updating)':''}`;break;
    }
    case 'addGeneratedCopy':{
      permit('coordinator');requireThat(w.brief.permission&&w.handedOffAt,'Confirm owner permission and hand off the brief before generating materials.');
      const title=value(action.title,'Material title',200,true),text=value(action.text,'Copywriting',20000,true),old=action.replacesId?w.materials.find(m=>m.id===action.replacesId):undefined;
      if(action.replacesId)requireThat(old&&!old.replacedBy&&!old.archivedAt&&old.kind==='copy'&&!old.original&&old.by==='Automation','Replace only a current automated copy material.');
      const id=uid();if(old)old.replacedBy=id;
      w.materials.push({id,kind:'copy',title,revision:(old?.revision||0)+1,original:false,text,replacesId:old?.id,review:'approved',note:'Generated from supplied listing facts; automatically released to Muz.',at:now,by:'Automation'});
      message=`Generated copywriting for Muz: ${title}`;break;
    }
    case 'removeMaterial':{
      const material=w.materials.find(m=>m.id===action.id);
      requireThat(material&&!material.replacedBy&&!material.archivedAt,'Select a current material to remove.');
      const mayRemove=material.original
        ?canWork(context.effective,w,'coordinator')||canWork(context.effective,w,'producer')
        :canWork(context.effective,w,'coordinator')||canWork(context.effective,w,'producer')||canWork(context.effective,w,'publisher');
      requireThat(mayRemove,'You do not have permission to remove this material.');
      material.archivedAt=now;material.archivedBy=context.effective.name;
      for(const d of w.destinations)if(d.approval?.materialIds.includes(material.id)&&!currentPublication(d))d.approval=null;
      message=`Removed ${material.kind} from current materials: ${material.title}; history retained`;
      break;
    }
    case 'submit':
      permit('producer');for(const m of materials(action.ids)){requireThat(['draft','changes'].includes(m.review),'Only draft materials or requested changes can be sent.');m.review='approved';m.note='Automatically released to Muz; no reviewer approval is required.';}
      message=`Sent ${action.ids.length} prepared material(s) to Muz automatically`;break;
    case 'review':{
      throw new Error('Manual reviewer approval is disabled. Prepared materials are released to Muz automatically.');
    }
    case 'addDestination':
      permit('publisher');requireThat(workflowChannels.some(c=>c.id===action.channelId),'Choose a publication channel.');
      requireThat(!w.destinations.some(d=>d.channelId===action.channelId),'That destination is already selected.');
      w.destinations.push({channelId:action.channelId,approval:null,blocked:'',publications:[]});message=`Selected ${workflowChannels.find(c=>c.id===action.channelId)!.name}`;break;
    case 'setDestinations':{
      permit('publisher');setDestinations(action.channelIds);
      message=`Muz selected ${w.destinations.length} publishing destination(s); unchecked platforms are excluded\nSelected: ${w.destinations.map(d=>workflowChannels.find(c=>c.id===d.channelId)!.name).join(', ')||'None'}`;break;
    }
    case 'approveForPublishing':{
      permit('publisher');requireThat(w.brief.permission,'Owner permission is required before publishing.');requireThat(w.handedOffAt,'Send the brief to production first.');
      requireThat(w.brief.tasks.every(t=>t.done),'Resolve the required checks in the owner brief first.');
      const chosen=materials(action.materialIds);
      requireThat(chosen.every(m=>['submitted','approved'].includes(m.review)),'Select only submitted or already approved materials.');
      setDestinations(action.channelIds);
      const ready=w.destinations.filter(d=>!d.approval).map(d=>({destination:d,package:publicationPackage(d.channelId,chosen)})).filter(item=>item.package.length>0);
      requireThat(ready.length>0,'No selected destinations are ready for a new approval. Existing approvals are already saved; select the missing materials or save platform choices.');
      const used=new Set(ready.flatMap(item=>item.package.map(m=>m.id)));
      let approvedCount=0;
      for(const m of chosen)if(used.has(m.id)&&m.review==='submitted'){m.review='approved';m.note='';approvedCount++;}
      for(const item of ready){item.destination.approval={id:uid(),materialIds:item.package.map(m=>m.id),at:now,by:context.effective.name};item.destination.blocked='';}
      const pending=w.destinations.filter(d=>!d.approval).length;
      message=`Muz selected ${ready.length} ready publishing destination(s)${pending?`; ${pending} destination(s) are waiting for materials`:''}\nPlatforms: ${ready.map(item=>workflowChannels.find(c=>c.id===item.destination.channelId)!.name).join(', ')}\nMaterials: ${chosen.filter(m=>used.has(m.id)).map(m=>m.title+' v'+m.revision).join(', ')}`;
      break;
    }
    case 'removeDestination':{
      permit('publisher');const d=destination(action.channelId);requireThat(!d.publications.length,'A published destination must retain its history.');
      w.destinations=w.destinations.filter(x=>x!==d);message=`Removed destination ${workflowChannels.find(c=>c.id===action.channelId)!.name}`;break;
    }
    case 'approveDestination':{
      permit('publisher');requireThat(w.brief.permission,'Owner permission is required before publishing.');requireThat(w.handedOffAt,'Send the brief to production first.');
      requireThat(w.brief.tasks.every(t=>t.done),'Resolve the required checks in the owner brief first.');
      const d=destination(action.channelId),chosen=materials(action.materialIds),c=workflowChannels.find(c=>c.id===d.channelId)!;
      requireThat(chosen.every(m=>m.review==='approved'),'Every selected material must be approved first.');
      requireThat(chosen.some(m=>m.kind==='copy')&&chosen.some(m=>c.video?m.kind==='video':['photo','poster','video'].includes(m.kind)),c.video?'Choose approved video and copywriting.':'Choose approved visual material and copywriting.');
      requireThat(!d.approval||JSON.stringify([...d.approval.materialIds].sort())!==JSON.stringify([...action.materialIds].sort()),'This exact package is already approved.');
      d.approval={id:uid(),materialIds:chosen.map(m=>m.id),at:now,by:context.effective.name};d.blocked='';message=`Prepared ${c.name} publishing package using ${chosen.map(m=>m.title+' v'+m.revision).join(', ')}`;break;
    }
    case 'publish':{
      permit('publisher');requireThat(w.brief.permission,'Owner permission has been withdrawn.');
      const d=destination(action.channelId),c=workflowChannels.find(c=>c.id===d.channelId)!;requireThat(d.approval,'Send this destination to publishing before recording the live ad.');
      requireThat(!currentPublication(d),'This approved package is already recorded as published.');
      requireThat(materials(d.approval.materialIds).every(m=>m.review==='approved'),'The prepared materials changed. Send the updated package to publishing.');
      const url=c.completion==='link'?httpUrl(value(action.url,'Ad URL',2048,true),true):'';
      d.publications.unshift({id:uid(),approvalId:d.approval.id,url,note:value(action.note||'','Publication note',2000),at:now,by:context.effective.name});d.blocked='';message=`${c.completion==='link'?'Published':'Completed'} ${c.name}${url?': '+url:''}`;break;
    }
    case 'block':{
      permit('publisher');const d=destination(action.channelId);requireThat(d.approval,'Send the destination to publishing with its required materials first.');
      requireThat(!currentPublication(d),'This destination is already published.');
      d.blocked=value(action.note,'Block reason',2000,true);message=`Publishing blocked: ${workflowChannels.find(c=>c.id===d.channelId)!.name} — ${d.blocked}`;break;
    }
    case 'sent':{
      permit('coordinator');requireThat(w.brief.permission,'Owner permission has been withdrawn.');
      requireThat(w.destinations.some(d=>currentPublication(d)),'Record at least one publication before sending an update.');
      const signature=reportSignature(w);requireThat(!w.sentReports.some(r=>r.signature===signature),'This version of the owner report is already marked sent.');
      const final=allPublished(w);w.sentReports.unshift({at:now,by:context.effective.name,signature,text:ownerReport(w),final});message=`Marked ${final?'completed':'interim'} report sent to owner`;break;
    }
    default:throw new Error('Unknown workflow action.');
  }
  if(action.type==='saveBrief'||(action.type==='addMaterial'&&action.original))invalidateProduction(w);
  w.version++;w.updatedAt=now;w.events.unshift({id:uid(),at:now,actualName:context.actual.name,effectiveName:context.effective.name,message});return w;
}
