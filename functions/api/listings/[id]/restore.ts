import {handleListings} from '../../_listings';
import type {AuthEnv} from '../../_auth';
export const onRequestPost=(context:{env:AuthEnv;request:Request;params:{id?:string}})=>handleListings({...context,id:context.params.id,restore:true});
