import {handleListings} from '../_listings';
import {getDb} from '../_db';
import {getSessionUser,type AuthEnv} from '../_auth';
type Context={env:AuthEnv;request:Request;params:{id?:string}};
export const onRequestPatch=(c:Context,services={getDb,getSessionUser})=>handleListings({...c,id:c.params.id},services);
export const onRequestDelete=(c:Context,services={getDb,getSessionUser})=>handleListings({...c,id:c.params.id},services);
