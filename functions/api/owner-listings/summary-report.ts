import {handleOwnerListings} from '../_owner-listings';
import type {AuthEnv} from '../_auth';
export const onRequest=(context:{request:Request;env:AuthEnv})=>handleOwnerListings({...context,action:'summary-report'});
