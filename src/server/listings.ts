import {Router} from 'express';
import {handleListings,type ListingServices} from '../../functions/api/_listings';
import type {AuthEnv} from '../../functions/api/_auth';
export function createListingsRouter(envProvider:()=>AuthEnv,services?:ListingServices){
 const router=Router();
 router.all(['/listings','/listings/:id','/listings/:id/restore'],async(req,res)=>{
  const response=await handleListings({env:envProvider(),id:req.params.id,restore:req.path.endsWith('/restore'),request:new Request(`http://localhost${req.originalUrl}`,{method:req.method,headers:{Cookie:req.headers.cookie||'','Content-Type':'application/json'},body:['GET','HEAD'].includes(req.method)?undefined:JSON.stringify(req.body||{})})},services);
  res.status(response.status).type('application/json').send(await response.text());
 });
 return router;
}
