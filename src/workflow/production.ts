import {canWork,workflowChannels,type Material,type WorkflowListing,type WorkflowContext,type WorkflowUser} from './model';
export type ProductionProvider='template'|'openai';
export const DEFAULT_POSTER_CONTACT='Dr Shahril · 019-388 5057';
export const POSTER_TEMPLATES=[
  {id:'suria-gallery',name:'Modern gallery',description:'Deep green accents, a photo mosaic and clean property facts.'},
  {id:'tangerine-editorial',name:'Soft editorial',description:'Warm neutrals, a full-width hero photo and an airy feature strip.'},
  {id:'laman-seri-premium',name:'Navy & gold',description:'A bold sale-focused look with a navy frame and gold price accents.'},
] as const;
export type PosterTemplateId=typeof POSTER_TEMPLATES[number]['id'];
export function defaultPosterTemplate(category:string,photoCount:number):PosterTemplateId{
  if(category==='Subsale')return 'laman-seri-premium';
  if(category==='Rental'&&photoCount<4)return 'tangerine-editorial';
  return photoCount>=4?'suria-gallery':'tangerine-editorial';
}
export function isPosterTemplate(value:unknown):value is PosterTemplateId{return POSTER_TEMPLATES.some(template=>template.id===value);}
export function randomPosterTemplate(random:()=>number=Math.random):PosterTemplateId{
  const value=random(),index=Number.isFinite(value)?Math.min(POSTER_TEMPLATES.length-1,Math.max(0,Math.floor(value*POSTER_TEMPLATES.length))):0;
  return POSTER_TEMPLATES[index].id;
}
export interface ProductionJob {
  id:string;provider:ProductionProvider;status:'queued'|'running'|'complete'|'failed'|'cancelled';
  posterTemplate?:PosterTemplateId;
  stage:string;fingerprint:string;channelIds:string[];sourceIds:string[];requestedBy:string;requestActor:WorkflowUser;requestUser:WorkflowUser;
  queuedAt:string;finishedAt?:string;leaseToken?:string;leaseUntil?:string;error?:string;materialIds?:string[];
}
export interface ProductionOutput {kind:Material['kind'];title:string;text?:string;fileKey?:string;mime?:string}
export type ProductionAction =
  | {type:'startProduction';provider:ProductionProvider;posterTemplate?:PosterTemplateId}
  | {type:'cancelProduction'}
  | {type:'manualProduction'}
  | {type:'productionWorker';operation:'claim'|'progress'|'complete'|'fail';runId:string;leaseToken?:string;stage?:string;outputs?:ProductionOutput[];error?:string};
function assert(condition:unknown,message:string):asserts condition {if(!condition)throw new Error(message);}
export const productionActive=(w:WorkflowListing)=>!!w.production&&['queued','running'].includes(w.production.status);
export function productionFingerprint(w:WorkflowListing){
  const {raw,...brief}=w.brief;
  return JSON.stringify({brief,sources:w.materials.filter(m=>m.original&&!m.replacedBy&&!m.archivedAt&&m.kind==='photo').map(m=>[m.id,m.fileKey])});
}
export function productionProblems(w:WorkflowListing):string[]{
  const missing:string[]=[];
  if(!w.brief.permission)missing.push('Confirm owner permission.');
  if(!w.brief.location.trim())missing.push('Fill in the location.');
  if(!w.brief.price.trim()||/pending|tbc|confirm|unknown/i.test(w.brief.price))missing.push('Fill in the confirmed asking price.');
  if(!w.brief.ownerName.trim()||!w.brief.phone.trim())missing.push('Fill in owner name and contact.');
  if(w.brief.tasks.some(t=>!t.done))missing.push('Resolve the required checks in the brief.');
  const photos=w.materials.filter(m=>m.original&&!m.replacedBy&&!m.archivedAt&&m.kind==='photo'&&m.fileKey);
  if(!photos.length)missing.push('Upload at least one original photo.');
  if(photos.length>12)missing.push('Use up to 12 current original photos for automatic production.');
  if(w.destinations.some(d=>d.publications.length))missing.push('This listing has published ads. Use the manual revision workflow to preserve published packages.');
  return missing;
}
export function defaultProductionChannels(category:WorkflowListing['brief']['category']){
  return workflowChannels.filter(c=>!['telegram-project','telegram-auction','facebook-new','facebook-auction',...(category==='Rental'?[]:['ibilik','speedhome'])].includes(c.id)).map(c=>c.id);
}
export function invalidateProduction(w:WorkflowListing){
  if(w.production&&w.production.fingerprint!==productionFingerprint(w)&&!['failed','cancelled'].includes(w.production.status)){
    w.production.status='cancelled';w.production.stage='Brief or source photos changed. Start a new production run.';w.production.finishedAt=new Date().toISOString();
    for(const d of w.destinations)d.approval=null;
    for(const m of w.materials)if(m.productionId&&!m.replacedBy&&!m.archivedAt){m.review='changes';m.note='The brief or source photos changed. Prepare a revised material before publishing.';}
  }
}
/** Trusted worker transitions are never authorized by client JSON. */
export function applyProduction(w:WorkflowListing,a:ProductionAction,context:WorkflowContext,now:string):string{
  if(a.type==='startProduction'||a.type==='cancelProduction'||a.type==='manualProduction')assert(canWork(context.effective,w,'coordinator'),'You do not have permission to manage automatic production.');
  if(a.type==='manualProduction'){
    assert(w.production&&!productionActive(w),'Cancel the active production job before returning to manual production.');
    w.production=undefined;return 'Returned to manual production; materials and publishing history retained';
  }
  if(a.type==='startProduction'){
    assert(!productionActive(w),'Production is already queued or running.');
    const problems=productionProblems(w);assert(!problems.length,problems.join(' '));
    assert(['template','openai'].includes(a.provider),'Choose a supported production mode.');
    assert(a.posterTemplate===undefined||isPosterTemplate(a.posterTemplate),'Choose a supported poster template.');
    const sourceIds=w.materials.filter(m=>m.original&&!m.replacedBy&&!m.archivedAt&&m.kind==='photo').map(m=>m.id);
    w.production={id:crypto.randomUUID(),provider:a.provider,posterTemplate:a.posterTemplate||defaultPosterTemplate(w.brief.category,sourceIds.length),status:'queued',stage:'Waiting for production worker',fingerprint:productionFingerprint(w),sourceIds,channelIds:[],requestedBy:context.effective.name,requestActor:{...context.actual},requestUser:{...context.effective},queuedAt:now};
    w.handedOffAt??=now;w.destinations=[];w.destinationSelectionSaved=false;
    return `Queued automatic production (${a.provider==='openai'?'OpenAI copy + template media':'template media + copy'})`;
  }
  if(a.type==='cancelProduction'){
    assert(productionActive(w),'There is no running production job to cancel.');
    w.production!.status='cancelled';w.production!.stage='Cancelled';w.production!.finishedAt=now;return 'Cancelled automatic production';
  }
  assert(context.productionWorker===true,'Only the production worker can update job results.');
  const job=w.production;assert(job&&job.id===a.runId,'This production run has changed.');
  assert(job.fingerprint===productionFingerprint(w),'The brief or photos changed during production.');
  if(a.operation==='claim'){
    assert(job.status==='queued'||(job.status==='running'&&Date.parse(job.leaseUntil||'')<Date.parse(now)),'This job is already claimed or finished.');
    job.status='running';job.leaseToken=crypto.randomUUID();job.leaseUntil=new Date(Date.parse(now)+10*60*1000).toISOString();job.stage='Preparing source photographs';return 'Automatic production started';
  }
  assert(job.status==='running','This production job is not running.');
  assert(a.leaseToken&&job.leaseToken===a.leaseToken&&Date.parse(job.leaseUntil||'')>Date.parse(now),'This production lease expired or belongs to another worker.');
  if(a.operation==='progress'){assert(typeof a.stage==='string'&&a.stage.length<=200,'Invalid production progress.');job.stage=a.stage;return `Automatic production: ${a.stage}`;}
  if(a.operation==='fail'){job.status='failed';job.stage='Production needs attention';job.error=String(a.error||'Production failed. Please retry.').slice(0,500);job.finishedAt=now;return 'Automatic production failed. Open Production for details and retry.';}
  assert(a.operation==='complete','Unknown production worker operation.');
  const outputs=a.outputs;
  assert(Array.isArray(outputs)&&outputs.length>=3&&outputs.length<=20,'Production returned an incomplete package.');
  assert(['copy','poster','video'].every(kind=>outputs.some(o=>o.kind===kind)),'Production must include copywriting, a poster and video.');
  for(const o of outputs){
    assert(['photo','poster','video','copy'].includes(o.kind)&&typeof o.title==='string'&&o.title.length>0&&o.title.length<=200,'Invalid generated material.');
    assert(o.kind==='copy'?typeof o.text==='string'&&o.text.length>0&&o.text.length<=20000:typeof o.fileKey==='string'&&o.fileKey.length>0&&typeof o.mime==='string','Generated material is empty.');
  }
  assert(!productionProblems(w).length,'Listing facts or permission need attention before handoff.');
  const generated:Material[]=outputs.map(o=>({...o,id:crypto.randomUUID(),revision:1,original:false,review:'approved',note:`Automatically prepared with ${job.provider==='openai'?'OpenAI copywriting and template media':'templates and supplied photos'}.`,at:now,by:'Automation',productionId:job.id}));
  for(const old of w.materials.filter(m=>m.productionId&&!m.replacedBy&&!m.archivedAt))old.replacedBy=(generated.find(m=>m.kind===old.kind)||generated[0]).id;
  w.materials.push(...generated);
  w.destinations=[];w.destinationSelectionSaved=false;job.status='complete';job.stage='Ready for Muz to choose platforms';job.finishedAt=now;job.materialIds=generated.map(m=>m.id);
  return `Automatic production complete: ${generated.length} materials ready for Muz to select platforms`;
}
