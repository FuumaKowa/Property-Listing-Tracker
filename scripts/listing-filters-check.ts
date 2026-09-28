import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
assert.ok(existsSync('src/utils/listingFilters.ts'), 'PIC filter compatibility helper must exist');
const { picOptions, matchesPic } = await import('../src/utils/listingFilters');
assert.deepEqual(picOptions(['Dsn / Iza','Dsn / Ikhwan','Akram/Benik/Fb']),['Akram','Akram/Benik/Fb','Benik','Dsn','Dsn / Ikhwan','Dsn / Iza','Fb','Ikhwan','Iza']);
assert.ok(matchesPic('Dsn / Iza','Dsn')); assert.ok(matchesPic('Akram/Benik/Fb','Benik')); assert.ok(!matchesPic('Dsn / Iza','Izan'));
console.log('PASS slash-separated PIC filtering');
