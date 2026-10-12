import assert from 'node:assert/strict';
import {ownerRowTone,OWNER_ROW_TONES} from '../src/utils/ownerRowColors';
const stages=[null,'Contacted','IFU1','IFU2','IFU3'] as const;
for(const stage of stages){
 const row={status:'Unlisted' as const,seedingStatus:stage};const original=JSON.stringify(row);
 assert.equal(ownerRowTone(row).key,stage??'not-contacted');
 assert.equal(ownerRowTone({...row,status:'Listed'}).key,'Listed','Listed overrides any seeding stage');
 assert.equal(ownerRowTone({...row,status:'Rejected'}).key,'Rejected','Rejected overrides any seeding stage');
 assert.equal(JSON.stringify(row),original,'Colour selection never changes stored values');
}
assert.equal(new Set(OWNER_ROW_TONES.map(value=>value.classes)).size,7,'All seven states have distinct whole-row colours');
console.log('PASS owner colours: all stages, Listed/Rejected precedence, distinct tones, immutable records');
