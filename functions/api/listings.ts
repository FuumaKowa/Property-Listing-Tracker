import {handleListings} from './_listings';
import {getDb} from './_db';
import {getSessionUser,type AuthEnv} from './_auth';
type Context={env:AuthEnv;request:Request};
export const onRequestGet=(c:Context)=>handleListings(c);
export const onRequestPost=(c:Context,services={getDb,getSessionUser})=>handleListings(c,services);
