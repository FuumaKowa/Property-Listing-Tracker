import type {WorkflowListing,WorkflowAction,WorkflowContext} from '../../workflow/model';
import type {ProductionAction,ProductionOutput} from '../../workflow/production';
import {ProductionError,renderProduction,type CopyOptions,type RenderedOutput} from './production-renderer';
export interface ProductionStore {
  list():WorkflowListing[]|Promise<WorkflowListing[]>;
  get?(id:string):Promise<WorkflowListing>;
  pendingProduction?():Promise<WorkflowListing[]>;
  action(id:string,version:number,action:WorkflowAction,context:WorkflowContext):Promise<WorkflowListing>;
}
export interface ProductionStorage {
  read(w:WorkflowListing,key:string):Promise<Buffer>;
  put(w:WorkflowListing,data:Buffer,extension:string,mime:string):Promise<string>;
  remove(w:WorkflowListing,key:string):Promise<void>;
}
/** Attribute the service action to the account that requested it, with Automation displayed as the executor. */
export function productionContext(w:WorkflowListing):WorkflowContext{
  const job=w.production;if(!job?.requestActor||!job.requestUser)throw new Error('Production requester is missing. Cancel and start a new run.');
  return {actual:{...job.requestActor},effective:{...job.requestUser,name:'Automation'},productionWorker:true};
}
export class ProductionRunner {
  private active=false;
  constructor(private store:ProductionStore,private storage:ProductionStorage,private options:CopyOptions={},private renderer=renderProduction){}
  private async update(id:string,action:Extract<ProductionAction,{type:'productionWorker'}>){
    for(let attempt=0;attempt<4;attempt++){
      const w=this.store.get?await this.store.get(id):(await this.store.list()).find(x=>x.id===id);if(!w)throw new Error('Workflow removed.');
      try{return await this.store.action(id,w.version,action,productionContext(w));}catch(error){
        if(attempt===3||!(/refresh/i.test((error as Error).message)))throw error;
      }
    }
    throw new Error('Workflow changed.');
  }
  async tick(){
    if(this.active)return;this.active=true;
    try{
      const rows=this.store.pendingProduction?await this.store.pendingProduction():await this.store.list();
      const candidates=rows.filter(w=>w.production?.status==='queued'||(w.production?.status==='running'&&Date.parse(w.production.leaseUntil||'')<Date.now()));
      for(const candidate of candidates)if(await this.run(candidate))break;
    }finally{this.active=false;}
  }
  private async run(candidate:WorkflowListing){
    let w:WorkflowListing;
    // Optimistic version plus the reducer's lease check is the cross-worker claim.
    try{w=await this.store.action(candidate.id,candidate.version,{type:'productionWorker',operation:'claim',runId:candidate.production!.id},productionContext(candidate));}catch{return false;}
    const job=w.production!,identity={type:'productionWorker' as const,runId:job.id,leaseToken:job.leaseToken};
    const written:string[]=[];let commitAttempted=false;
    try{
      const sourcePhotos:Buffer[]=[];let bytes=0;
      for(const id of job.sourceIds){const key=w.materials.find(m=>m.id===id)?.fileKey;if(!key)throw new ProductionError('An original photo is missing. Upload it again.');const data=await this.storage.read(w,key);bytes+=data.length;if(bytes>150*1024*1024)throw new ProductionError('Original photos exceed 150 MB. Use smaller photos.');sourcePhotos.push(data);}
      const rendered:RenderedOutput[]=await this.renderer(w,sourcePhotos,async stage=>{await this.update(w.id,{...identity,operation:'progress',stage});},this.options);
      await this.update(w.id,{...identity,operation:'progress',stage:'Saving publishing package'});
      const outputs:ProductionOutput[]=[];
      for(const output of rendered){
        if(output.kind==='copy')outputs.push({kind:output.kind,title:output.title,text:output.text});
        else{if(!output.data||!output.extension||!output.mime)throw new Error('Incomplete rendered media.');const key=await this.storage.put(w,output.data,output.extension,output.mime);written.push(key);outputs.push({kind:output.kind,title:output.title,fileKey:key,mime:output.mime});}
      }
      commitAttempted=true;await this.update(w.id,{...identity,operation:'complete',outputs});
    }catch(error){
      // Never delete files after an ambiguous successful database commit.
      let current:WorkflowListing|undefined;
      try{current=this.store.get?await this.store.get(w.id):(await this.store.list()).find(x=>x.id===w.id);}catch{if(commitAttempted)return true;}
      if(current?.production?.id===job.id&&current.production.status==='complete')return true;
      const referenced=new Set(current?.materials.map(m=>m.fileKey));
      await Promise.allSettled(written.filter(key=>!referenced.has(key)).map(key=>this.storage.remove(w,key)));
      const message=error instanceof ProductionError?error.message:'Production could not finish. Your original information is saved. Retry, or ask the administrator to check the worker.';
      await this.update(w.id,{...identity,operation:'fail',error:message}).catch(()=>{});
    }
    return true;
  }
  start(intervalMs=3000){
    const run=()=>{void this.tick().catch(()=>console.error('Production worker could not read the queue. It will retry.'));};
    const timer=setInterval(run,intervalMs);timer.unref();run();return ()=>clearInterval(timer);
  }
}
