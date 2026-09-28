import assert from 'node:assert/strict';
import { parseCSVToListings } from '../src/utils/storage';
const header='No.,Property,Project Category,Location,Tenure,PM,Available Units,Status,Date,Renew Status,Negotiator,Agent,No Tel,Notes,PropertyGuru Repost Date,PropertyGuru Repost Mode';
const result=parseCSVToListings(header+'\n1,"Home, with a balcony",Rental,KL,Freehold,PIC,1,Sold Out,2020-01-01,In Progress,Lister,Agent,01234,Notes,2026-10-10,Auto',1)[0];
assert.equal(result.status,'Sold Out');assert.equal(result.renewStatus,'In Progress');assert.equal(result.negotiator,'Lister');assert.equal(result.agent,'Agent');assert.equal(result.noTel,'01234');assert.equal(result.propertyGuruRepostDate,'2026-10-10');assert.equal(result.propertyGuruRepostMode,'Auto');
console.log('PASS legacy CSV compatibility and contact/repost preservation');
