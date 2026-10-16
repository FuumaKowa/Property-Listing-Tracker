import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {applyWorkflowAction,createWorkflow,type Brief,type WorkflowAction,type WorkflowContext,type WorkflowListing} from '../../workflow/model';
import {seedWorkflow} from '../../workflow/seed';

export class WorkflowConflict extends Error {}
interface State {listings:WorkflowListing[];switches:{at:string;actual:string;from:string;to:string}[]}
export class LocalWorkflowStore {
  readonly directory:string;
  private state:State={listings:[],switches:[]};
  private queue:Promise<unknown>=Promise.resolve();
  constructor(directory:string){this.directory=resolve(directory);}
  async init(){
    await mkdir(join(this.directory,'media'),{recursive:true});
    try{this.state=JSON.parse(await readFile(join(this.directory,'state.json'),'utf8'));}
    catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;this.state={listings:seedWorkflow(),switches:[]};await this.persist(this.state);}
    const sample=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lLG+WAAAAABJRU5ErkJggg==','base64');
    await writeFile(join(this.directory,'media','sample-photo.png'),sample);
  }
  list(){return structuredClone(this.state.listings);}
  private async persist(next:State){
    const temp=join(this.directory,`state-${randomUUID()}.tmp`);
    try{await writeFile(temp,JSON.stringify(next,null,2),'utf8');await rename(temp,join(this.directory,'state.json'));}
    catch(e){await unlink(temp).catch(()=>{});throw e;}
  }
  private change<T>(fn:(next:State)=>T):Promise<T>{
    const result=this.queue.then(async()=>{const next=structuredClone(this.state),result=fn(next);await this.persist(next);this.state=next;return structuredClone(result);});
    this.queue=result.catch(()=>{});return result;
  }
  async create(brief:Brief,context:WorkflowContext){return this.change(next=>{
    if(next.listings.length>=500)throw new Error('This preview supports up to 500 workflows.');
    const w=createWorkflow(brief,context);if(next.listings.some(x=>x.brief.reference===w.brief.reference))throw new Error('This reference already has a workflow. Open the existing listing.');
    next.listings.unshift(w);return w;
  });}
  async action(id:string,version:number,action:WorkflowAction,context:WorkflowContext){return this.change(next=>{
    const index=next.listings.findIndex(w=>w.id===id);if(index<0)throw new Error('Listing not found.');
    if(!Number.isSafeInteger(version)||next.listings[index].version!==version)throw new WorkflowConflict('This listing changed. Refresh to load the latest version before saving.');
    const w=applyWorkflowAction(next.listings[index],action,context);
    if(next.listings.some(x=>x.id!==w.id&&x.brief.reference===w.brief.reference))throw new Error('This reference already belongs to another workflow.');
    next.listings[index]=w;return w;
  });}
  async recordSwitch(actual:string,from:string,to:string){return this.change(next=>{next.switches.push({at:new Date().toISOString(),actual,from,to});next.switches=next.switches.slice(-1000);});}
  filePath(key:string){
    if(!/^(?:[a-f0-9-]{36}|sample-photo)\.(?:jpg|png|webp|mp4|webm)$/.test(key))throw new Error('Invalid file key.');
    return join(this.directory,'media',key);
  }
  async putFile(data:Buffer,extension:string){const key=randomUUID()+'.'+extension;await writeFile(this.filePath(key),data);return key;}
  async removeFile(key:string){await unlink(this.filePath(key)).catch(()=>{});}
}
