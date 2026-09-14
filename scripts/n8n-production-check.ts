import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

assert(existsSync('.server/server.cjs'), 'Run npm run build first');
assert(!existsSync('dist/server.cjs') && !existsSync('dist/server.cjs.map'), 'Node source must not be published as a Pages asset');
function checkAssets(folder: string) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) checkAssets(file);
    else if (/\.(js|html|map)$/.test(file)) assert(!readFileSync(file, 'utf8').includes('N8N_INGEST_API_KEY'), `Ingestion configuration leaked into ${file}`);
  }
}
checkAssets('dist');
const reservation = createServer().listen(0, '127.0.0.1');
await once(reservation, 'listening');
const address = reservation.address();
assert(address && typeof address !== 'string');
await new Promise<void>(resolve => reservation.close(() => resolve()));
const testKey = 'only-for-local-production-smoke-test';
const child = spawn(process.execPath, ['.server/server.cjs'], {
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production', PORT: String(address.port), N8N_INGEST_API_KEY: testKey,
    DATABASE_URL: 'postgresql://test:test@127.0.0.1:9/test', NEON_DATABASE_URL: 'postgresql://test:test@127.0.0.1:9/test' },
});
try {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Production server did not start')), 15000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Production server exited with ${code}`)); });
    child.stdout.on('data', data => { if (String(data).includes('Server listening')) { clearTimeout(timer); resolve(); } });
  });
  const origin = `http://127.0.0.1:${address.port}`;
  assert.equal((await (await fetch(`${origin}/api/health`)).json()).status, 'ok');
  const home = await fetch(origin);
  assert.equal(home.status, 200);
  assert((await home.text()).includes('Property Listing Tracker'));
  const endpoint = `${origin}/api/integrations/n8n/owner-listings`;
  assert.equal((await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 401);
  const failure = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': testKey }, body: JSON.stringify({ source: 'test', listing_id: '1', url: 'https://example.com/1', title: 'Test', price: 1, property_type: 'landed' }) });
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), { success: false, error: 'Unable to store listing. Please retry.' });
  console.log('PASS built Node startup, static homepage, existing health route, secure integration, and no backend artifacts/key configuration in public assets');
} finally { child.kill(); }
