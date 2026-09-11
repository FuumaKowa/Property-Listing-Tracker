import assert from 'node:assert/strict';
import { autoExpireListings, evaluateListingExpiry } from '../src/utils/dateUtils';
import { PropertyListing, RenewStatus } from '../src/types';

const now = new Date(2026, 8, 11, 12);
const expired: PropertyListing = { id: 1, property: 'Test', location: '-', tenure: '-', pm: '-', availableUnits: '-', status: 'Expired', date: '2026-09-01', renewStatus: 'Not Renewed' };
for (const renewStatus of ['Not Renewed', 'Want to be renew', 'In Progress'] as RenewStatus[]) {
  const edited = { ...expired, renewStatus };
  assert.equal(evaluateListingExpiry(edited, now).renewStatus, renewStatus, 'Saving must preserve renewal intent');
  let result = autoExpireListings([edited], now);
  assert.equal(result.updatedListings[0].renewStatus, renewStatus, 'Initial refresh must preserve renewal intent');
  for (let tick = 0; tick < 10; tick++) result = autoExpireListings(result.updatedListings, now);
  assert.equal(result.updatedListings[0].renewStatus, renewStatus, 'Periodic checks must preserve renewal intent');
  assert.equal(result.changedCount, 0, 'Unchanged checks must not trigger another database write');
}
const newlyExpired = autoExpireListings([{ ...expired, status: 'Active', renewStatus: 'Renewed' }], now);
assert.equal(newlyExpired.updatedListings[0].status, 'Expired');
assert.equal(newlyExpired.updatedListings[0].renewStatus, 'Not Renewed');
assert.equal(newlyExpired.changedCount, 1, 'Count changed rows once');
assert.deepEqual(newlyExpired.expiredIds, [1]);
const future = evaluateListingExpiry({ ...expired, date: '2099-12-31', renewStatus: 'Want to be renew' }, now);
assert.equal(future.status, 'Active');
assert.equal(future.renewStatus, 'Want to be renew');
for (const date of ['', '-', 'N/A', 'invalid', '31.02.2026']) {
  const row = { ...expired, date };
  assert.equal(evaluateListingExpiry(row, now), row, 'Missing or invalid dates must not rewrite status');
}
console.log('PASS renewal intent survives save, reload, repeated expiry checks, and date changes');
