import {handleOwnerListings} from '../../_owner-listings';
export const onRequest=(context:Parameters<typeof handleOwnerListings>[0])=>handleOwnerListings({...context,action:'assignment'});
