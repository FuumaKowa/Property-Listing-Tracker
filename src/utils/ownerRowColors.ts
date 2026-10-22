import type {OwnerListing} from '../ownerListing';
export const OWNER_ROW_TONES = [
 {key:'not-contacted',label:'Not contacted',classes:'bg-white'},
 {key:'Contacted',label:'Contacted',classes:'bg-yellow-100'},
 {key:'IFU1',label:'IFU1',classes:'bg-blue-50'},
 {key:'IFU2',label:'IFU2',classes:'bg-blue-100'},
 {key:'IFU3',label:'IFU3',classes:'bg-blue-200'},
 {key:'Invalid link',label:'Invalid link',classes:'bg-orange-100'},
 {key:'Listed',label:'Listed',classes:'bg-green-100'},
 {key:'Rejected',label:'Rejected',classes:'bg-red-100'},
] as const;
// Final listing status overrides progress. Alerts are separate badges.
export function ownerRowTone(row:Pick<OwnerListing,'status'|'seedingStatus'>){
 const key=row.status==='Listed'||row.status==='Rejected'?row.status:row.seedingStatus;
 return OWNER_ROW_TONES.find(tone=>tone.key===key)??OWNER_ROW_TONES[0];
}
