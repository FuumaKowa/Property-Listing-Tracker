import assert from 'node:assert/strict';
import {planListingLocationRepairs} from '../src/listingLocationAudit';
const rows=[{id:1,version:2,property:'*FOR RENT | TANGERINE SUITES @ SUNSURIA CITY, SEPANG',location:'Pending details'},{id:2,version:1,property:'Commercial bungalow Petaling Jaya, Selangor',location:'-'},{id:3,version:3,property:'Home in Kajang',location:'Verified location'},{id:4,version:1,property:'Unknown Farm',location:'-'},{id:5,version:1,property:'Home in Kajang or Bangi',location:null}];
const result=planListingLocationRepairs(rows,[]);assert.equal(result.checked,5);assert.equal(result.repairs.length,2);assert.deepEqual(result.repairs[0].after,{property:'TANGERINE SUITES @ SUNSURIA CITY, SEPANG',location:'Sunsuria City, Sepang'});assert.equal(result.repairs[1].after.location,'Petaling Jaya');assert.deepEqual(result.unresolved.map(r=>r.id),[4,5]);assert.equal(result.repairs.some(r=>r.id===3),false);
assert.equal(planListingLocationRepairs(rows.map(r=>({...r,...result.repairs.find(p=>p.id===r.id)?.after})),[]).repairs.length,0,'Audit is idempotent');
console.log('PASS full-dataset location audit, preserved known locations, pending manual review and idempotence');
