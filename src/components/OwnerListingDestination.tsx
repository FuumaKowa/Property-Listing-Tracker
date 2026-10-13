import type { OwnerListingInput } from '../ownerListing';

export function OwnerListingDestination({knownType,value,onChange}:{knownType?:OwnerListingInput['transactionType'];value:OwnerListingInput['transactionType'];onChange:(value:'rent'|'sale'|null)=>void}) {
 if(knownType === 'rent' || knownType === 'sale') return <p className="text-sm text-indigo-700 sm:col-span-2">Saving as Listed will append this property to {knownType === 'rent' ? 'Rental' : 'Subsale Direct Listing'} if it has not already been added.</p>;
 return <label className="ui-label sm:col-span-2">Where should this listing be appended?
  <select aria-label="Where should this listing be appended?" className="ui-input" required value={value || ''} onChange={e=>onChange(e.target.value as 'rent'|'sale' || null)}>
   <option value="">Choose a listing category</option>
   <option value="rent">Rental</option>
   <option value="sale">Subsale Direct Listing</option>
  </select>
  <span className="text-xs text-slate-500">Select a category before saving as Listed.</span>
 </label>;
}
