import express,{type Request,type Response,type NextFunction} from 'express';
import {randomBytes} from 'node:crypto';
import {LocalWorkflowStore,WorkflowConflict} from './store';
import {previewUsers} from '../../workflow/seed';
import {workflowChannels,type WorkflowUser,type WorkflowContext,type MaterialKind} from '../../workflow/model';

interface Session {actual:WorkflowUser;effective:WorkflowUser;csrf:string;expires:number}
export function createWorkflowRouter(store:LocalWorkflowStore,authenticate:(req:Request)=>Promise<WorkflowUser|null>,production={enabled:false,openaiReady:false}){
  const router=express.Router(),sessions=new Map<string,Session>();
  router.use(express.json({limit:'1mb'}));
  router.use((req,res,next)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const host=req.headers.host||'';
    if(!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host))return void res.status(403).json({error:'The workflow preview is available on localhost only.'});
    if(req.headers.origin&&req.headers.origin!==`http://${host}`)return void res.status(403).json({error:'Use the workflow preview from the same local browser origin.'});
    next();
  });
  const token=(req:Request)=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('workflow_preview='))?.slice('workflow_preview='.length)||'';
  const payload=(s:Session)=>({actual:s.actual,effective:s.effective,csrf:s.csrf,users:s.actual.role==='super_admin'?previewUsers:[],localPreview:true,storageReady:true,production});
  const safe=(fn:(req:Request,res:Response)=>Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>{void fn(req,res).catch(next);};
  router.get('/session',safe(async(req,res)=>{
    const now=Date.now();for(const [id,s] of sessions)if(s.expires<now)sessions.delete(id);
    let s=sessions.get(token(req));
    if(!s){const actual=await authenticate(req);if(!actual)return res.status(401).json({error:'Sign in to open this workflow.'});
      if(sessions.size>200)return res.status(429).json({error:'Too many preview sessions. Restart the local preview.'});
      const id=randomBytes(32).toString('hex');s={actual:{...actual},effective:{...actual},csrf:randomBytes(32).toString('hex'),expires:now+12*60*60*1000};sessions.set(id,s);
      res.cookie('workflow_preview',id,{httpOnly:true,sameSite:'strict',path:'/api/workflow',maxAge:12*60*60*1000});
    }
    return res.json(payload(s));
  }));
  router.use((req,res,next)=>{
    const s=sessions.get(token(req));if(!s||s.expires<Date.now())return void res.status(401).json({error:'Your preview session expired. Refresh to continue.'});
    if(req.method!=='GET'&&req.get('X-Workflow-CSRF')!==s.csrf)return void res.status(403).json({error:'Refresh this page before making changes.'});
    res.locals.session=s;next();
  });
  const context=(res:Response):WorkflowContext=>({actual:{...res.locals.session.actual},effective:{...res.locals.session.effective}});
  router.post('/switch',safe(async(req,res)=>{
    const s:Session=res.locals.session;if(s.actual.role!=='super_admin')return res.status(403).json({error:'Only the signed-in SuperAdmin can switch users.'});
    const target=previewUsers.find(u=>u.id===req.body?.userId);if(!target)return res.status(400).json({error:'Choose an existing preview user.'});
    await store.recordSwitch(s.actual.name,s.effective.name,target.name);s.effective={...target};return res.json(payload(s));
  }));
  router.get('/listings',(_req,res)=>res.json({listings:store.list(),channels:workflowChannels,users:previewUsers}));
  router.post('/listings',safe(async(req,res)=>res.status(201).json({listing:await store.create(req.body?.brief,context(res))})));
  router.post('/listings/:id/actions',safe(async(req,res)=>{
    const action=req.body?.action;
    if(action?.type==='productionWorker')return res.status(403).json({error:'Only the production worker can update job results.'});
    if(action?.type==='startProduction'&&(!production.enabled||(action.provider==='openai'&&!production.openaiReady)))return res.status(503).json({error:!production.enabled?'Automatic production worker is not connected.':'Connect an OpenAI API key or choose Templates.'});
    if(action?.type==='addMaterial'&&(action.kind!=='copy'||action.fileKey||action.mime))throw new Error('Use the file upload control for photos, posters and videos.');
    return res.json({listing:await store.action(req.params.id,req.body?.version,action,context(res))});
  }));
  router.post('/listings/:id/files',express.raw({type:()=>true,limit:'30mb',inflate:false}),safe(async(req,res)=>{
    const data=req.body,mime=req.get('Content-Type')?.split(';')[0]||'';
    if(!Buffer.isBuffer(data)||data.length===0)throw new Error('Choose an image or video file.');
    let extension='';
    if(mime==='image/png'&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))extension='png';
    else if(mime==='image/jpeg'&&data[0]===255&&data[1]===216&&data[2]===255)extension='jpg';
    else if(mime==='image/webp'&&data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP')extension='webp';
    else if(mime==='video/mp4'&&data.toString('ascii',4,8)==='ftyp')extension='mp4';
    else if(mime==='video/webm'&&data.subarray(0,4).equals(Buffer.from([26,69,223,163])))extension='webm';
    if(!extension)throw new Error('Upload a valid JPEG, PNG, WebP, MP4 or WebM file (up to 30 MB).');
    const kind=String(req.query.kind) as MaterialKind;
    if(!['photo','poster','video'].includes(kind)||(kind==='video')!==mime.startsWith('video/'))throw new Error('Choose the matching photo, poster or video type.');
    const key=await store.putFile(data,extension);
    const generated=req.query.generated==='true';if(generated&&kind!=='poster')throw new Error('Only generated posters can use automatic release.');
    try{return res.json({listing:await store.action(req.params.id,Number(req.query.version),{type:'addMaterial',kind,title:String(req.query.title||'Uploaded material'),fileKey:key,mime,original:req.query.original==='true',generated,replacesId:typeof req.query.replacesId==='string'?req.query.replacesId:undefined},context(res))});}
    catch(e){await store.removeFile(key);throw e;}
  }));
  router.get('/files/:key',(req,res,next)=>{
    try{const material=store.list().flatMap(w=>w.materials).find(m=>m.fileKey===req.params.key);if(!material)return void res.status(404).json({error:'File not found.'});
      res.type(material.mime||'application/octet-stream');res.setHeader('Content-Disposition',`${req.query.download?'attachment':'inline'}; filename="${encodeURIComponent(material.title)}.${req.params.key.split('.').at(-1)}"`);
      res.sendFile(store.filePath(req.params.key),error=>{if(error)next(error);});
    }catch(e){next(e);}
  });
  router.use((error:Error&{status?:number},_req:Request,res:Response,_next:NextFunction)=>{
    if(res.headersSent)return;
    res.status(error instanceof WorkflowConflict?409:error.status===413?413:400).json({error:error.status===413?'The file is too large. Use a file under 30 MB.':error.message||'Unable to save this change.'});
  });
  return router;
}
