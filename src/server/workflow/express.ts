import express from 'express';
import {handleWorkflow,type WorkflowEnv,type WorkflowServices} from '../../../functions/api/_workflow';
export function createDatabaseWorkflowRouter(env:()=>WorkflowEnv,services?:WorkflowServices){
 const router=express.Router();router.use(express.raw({type:()=>true,limit:'30mb',inflate:false}));
 router.use(async(req,res,next)=>{try{
  const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(typeof value==='string')headers.set(key,value);
  const body=['GET','HEAD'].includes(req.method)?undefined:Buffer.isBuffer(req.body)?req.body:JSON.stringify(req.body||{});
  const response=await handleWorkflow({env:env(),request:new Request(`${req.protocol}://${req.get('host')}${req.originalUrl}`,{method:req.method,headers,body})},services);
  response.headers.forEach((v,k)=>res.setHeader(k,v));res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
 }catch(error){next(error);}});return router;
}
