import assert from 'node:assert/strict';
import { evaluateListingExpiry } from '../src/utils/dateUtils';
import type { PropertyListing } from '../src/types';
const base: PropertyListing = { id: 1, property: 'P', location: 'KL', tenure: '-', pm: 'PIC', availableUnits:'1',date:'2020-01-01',status:'Sold Out',renewStatus:'Want to be renew' };
for (const status of ['Sold Out','Pending'] as const) for (const date of ['2020-01-01','2099-01-01']) assert.equal(evaluateListingExpiry({...base,status,date}).status,status);
for (const renewStatus of ['Want to be renew','In Progress'] as const) assert.equal(evaluateListingExpiry({...base,status:'Active',renewStatus}).renewStatus,renewStatus);
console.log('PASS sold/pending preservation and renewal intent');
