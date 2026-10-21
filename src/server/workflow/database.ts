import {applyWorkflowAction,createWorkflow,validateBrief,type Brief,type WorkflowAction,type WorkflowContext,type WorkflowListing,type WorkflowUser} from '../../workflow/model';
import {syncWorkflow,type LinkChoices,WorkflowSyncError} from './sync';
export interface WorkflowDb {query:(sql:string,params?:unknown[])=>Promise<any[]>}
export type WorkflowTransaction=<T>(fn:(db:WorkflowDb)=>Promise<T>)=>Promise<T>;
export class DatabaseWorkflowStore {
 constructor(private db:WorkflowDb,private transact:WorkflowTransaction,private users:WorkflowUser[]){}
 async list(){return (await this.db.query('SELECT data FROM marketing_workflows ORDER BY updated_at DESC')).map(r=>r.data as WorkflowListing);}
 async pendingProduction(){return (await this.db.query("SELECT data FROM marketing_workflows WHERE data->'production'->>'status' IN ('queued','running') ORDER BY updated_at ASC LIMIT 100")).map(r=>r.data as WorkflowListing);}
 async get(id:string){const row=(await this.db.query('SELECT data FROM marketing_workflows WHERE id=$1',[id]))[0];if(!row)throw new WorkflowSyncError('Workflow not found.',404);return row.data as WorkflowListing;}
 private async lock(db:WorkflowDb){
  await db.query("SET LOCAL lock_timeout='8s'");
  // Same ordering as the existing owner/report writers. Matching and creation share this lock.
  await db.query('LOCK TABLE owner_listings IN SHARE ROW EXCLUSIVE MODE');
  await db.query('LOCK TABLE listings IN SHARE ROW EXCLUSIVE MODE');
  await db.query('LOCK TABLE marketing_workflows IN SHARE ROW EXCLUSIVE MODE');
 }
 async create(brief:Brief,context:WorkflowContext,choices:LinkChoices={}){
  const proposed=createWorkflow(brief,context);
  for(const role of ['coordinator','producer','reviewer','publisher'] as const){const person=this.users.find(u=>u.role===role);if(!person)throw new WorkflowSyncError(`Configure the ${role} workflow account before creating a listing.`,409);proposed.assignees[role]=person.id;}
  return this.transact(async db=>{
   await this.lock(db);
   const existing=(await db.query('SELECT data FROM marketing_workflows WHERE reference=$1',[proposed.brief.reference]))[0]?.data as WorkflowListing|undefined;
   if(existing){if(JSON.stringify(validateBrief(existing.brief))===JSON.stringify(proposed.brief))return existing;throw new WorkflowSyncError('This reference already has a workflow. Open it to update the details.',409,{workflowId:existing.id});}
   await syncWorkflow(db,proposed,null,context,choices);
   await db.query('INSERT INTO marketing_workflows(id,reference,owner_listing_id,listing_id,version,data) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[proposed.id,proposed.brief.reference,proposed.links!.ownerId,proposed.links!.listingId,proposed.version,JSON.stringify(proposed)]);
   return proposed;
  });
 }
 async action(id:string,version:number,action:WorkflowAction,context:WorkflowContext){return this.transact(async db=>{
  await this.lock(db);
  const record=(await db.query('SELECT * FROM marketing_workflows WHERE id=$1 FOR UPDATE',[id]))[0];
  if(!record)throw new WorkflowSyncError('Workflow not found.',404);
  if(!Number.isSafeInteger(version)||record.version!==version)throw new WorkflowSyncError('This workflow changed. Refresh before saving.',409);
  const previous=record.data as WorkflowListing;
  // Job metadata remains recoverable even if a linked listing was deleted externally.
  const metadataOnly=action?.type==='productionWorker'&&action.operation!=='complete';
  if(metadataOnly){const next=applyWorkflowAction(previous,action,context);await db.query('UPDATE marketing_workflows SET version=$2,data=$3::jsonb,updated_at=now() WHERE id=$1',[id,next.version,JSON.stringify(next)]);return next;}
  if(!record.owner_listing_id||previous.links?.listingId&&!record.listing_id)throw new WorkflowSyncError('A linked listing was deleted. Restore it or resolve the record link before continuing.',409);
  const next=applyWorkflowAction(previous,action,context);
  if(next.brief.reference!==previous.brief.reference)throw new WorkflowSyncError('The reference is linked to your listing records and cannot be changed here.',409);
  if(['publish','approveDestination','approveForPublishing','startProduction'].includes(action.type)||(action.type==='productionWorker'&&action.operation==='complete')){
   const rows=await db.query('SELECT o.status,l.archived_at FROM owner_listings o LEFT JOIN listings l ON l.id=$2 WHERE o.id=$1',[record.owner_listing_id,record.listing_id]);
   if(rows[0]?.status!=='Listed'||rows[0]?.archived_at)throw new WorkflowSyncError('The linked listing is unlisted or archived. Confirm owner permission and restore it before publishing.',409);
  }
  await syncWorkflow(db,next,previous,context);
  await db.query('UPDATE marketing_workflows SET version=$2,data=$3::jsonb,owner_listing_id=$4,listing_id=$5,updated_at=now() WHERE id=$1',[id,next.version,JSON.stringify(next),next.links!.ownerId,next.links!.listingId]);
  return next;
 });}
}
