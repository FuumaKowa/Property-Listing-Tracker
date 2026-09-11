// Start Vite on port 3000. Install the temporary test tools documented in owner-api-check.ts.
// npx tsx scripts/owner-ui-check.ts. Uses headless Edge and local PGlite; no live data.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { handleOwnerListings } from '../functions/api/_owner-listings';
import { OwnerListingDb } from '../src/db/ownerListings';

const postgres = new PGlite();
const db: OwnerListingDb = { query: async (sql, params) => (await postgres.query<Record<string, unknown>>(sql, params)).rows };
const user = { id: 1, username: 'tester', displayName: 'Test User', role: 'super_admin' as const };
const services = { authenticate: async () => user, connect: () => db };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
let failSave = false;
let listing = { id: 1, property: 'Expired test property', projectCategory: 'Project Marketing (PM)', location: 'KL', tenure: 'Freehold', pm: 'Test', availableUnits: '1', date: '2020-01-01', status: 'Expired', renewStatus: 'Not Renewed' };
await page.route('**/api/**', async route => {
  const req = route.request();
  const path = new URL(req.url()).pathname;
  if (path.startsWith('/api/owner-listings')) {
    if (failSave && ['POST', 'PATCH'].includes(req.method())) return route.fulfill({ status: 500, json: { error: 'Test save failed. Please try again.' } });
    const response = await handleOwnerListings({ env: { DATABASE_URL: 'test-only' },
      params: path.split('/')[3] ? { id: path.split('/')[3] } : undefined,
      request: new Request(req.url(), { method: req.method(), body: req.postData() || undefined }),
    }, services);
    return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
  }
  if (path === '/api/auth/me') return route.fulfill({ json: { authenticated: true, user } });
  if (path === '/api/listings/1' && req.method() === 'PATCH') listing = { ...listing, ...req.postDataJSON() };
  return route.fulfill({ json: { data: path === '/api/listings' ? [listing] : path === '/api/listings/1' ? listing : [] } });
});
async function fits(label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(overflow <= 1, `${label}: document overflows by ${overflow}px`);
}
async function ownerTab() {
  await page.getByRole('button', { name: 'Master Listing Owner', exact: true }).click();
  await page.getByRole('button', { name: 'Add owner listing', exact: true }).waitFor();
}
try {
  for (const [width, height] of [[320,568], [390,844], [667,375], [768,1024], [1024,768], [1920,1080]]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:3000');
    await ownerTab();
    await page.getByRole('button', { name: 'Add owner listing', exact: true }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Owner name', { exact: true }).fill('Test Owner');
    await form.getByLabel('Phone number', { exact: true }).fill('0123456789');
    await form.getByLabel('Property name', { exact: true }).fill('Owner Test Property');
    await form.getByLabel('Property price', { exact: true }).fill('1250000.50');
    await form.getByLabel('Property link (optional)', { exact: true }).fill('https://example.com/original-post?id=123');
    await form.getByLabel('Property type', { exact: true }).selectOption('highrise');
    await form.getByLabel('Status', { exact: true }).selectOption('Listed');
    await fits(`form ${width}`);
    const bounds = await form.boundingBox();
    assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= height + 1, 'Form must fit viewport');
    if (width === 320) {
      failSave = true;
      await form.getByRole('button', { name: 'Save owner listing', exact: true }).click();
      await form.getByRole('alert').waitFor();
      assert.equal(await form.getByLabel('Owner name', { exact: true }).inputValue(), 'Test Owner');
      failSave = false;
    }
    await form.getByRole('button', { name: 'Save owner listing', exact: true }).click();
    await form.waitFor({ state: 'hidden' });
    await page.getByText('1 of 1 owner listings', { exact: true }).waitFor();
    await fits(`owner sheet ${width}`);
    await page.getByRole('combobox', { name: 'Status for Owner Test Property' }).filter({ visible: true }).selectOption('Unlisted');
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByText('1 of 1 owner listings', { exact: true }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Status for Owner Test Property' }).filter({ visible: true }).inputValue(), 'Unlisted');
    await page.getByRole('combobox', { name: 'Property type for Owner Test Property' }).filter({ visible: true }).selectOption('land');
    await page.getByRole('button', { name: 'Edit Owner Test Property', exact: true }).filter({ visible: true }).click();
    await form.getByLabel('Property type', { exact: true }).selectOption('commercial');
    await form.getByLabel('Property price', { exact: true }).fill('2500000.00');
    await form.getByRole('button', { name: 'Save owner listing', exact: true }).click();
    await form.waitFor({ state: 'hidden' });
    await page.reload(); await ownerTab();
    await page.getByText('1 of 1 owner listings', { exact: true }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Property type for Owner Test Property' }).filter({ visible: true }).inputValue(), 'commercial');
    const postLink = page.getByRole('link', { name: 'Open original post for Owner Test Property (opens in a new tab)', exact: true }).filter({ visible: true });
    assert.equal(await postLink.getAttribute('href'), 'https://example.com/original-post?id=123');
    await page.context().route('https://example.com/**', route => route.fulfill({ body: '<h1>Original post</h1>', contentType: 'text/html' }));
    const [post] = await Promise.all([page.waitForEvent('popup'), postLink.click()]);
    await post.waitForLoadState();
    assert.equal(post.url(), 'https://example.com/original-post?id=123');
    await post.close();
    await page.getByLabel('Search owner listings', { exact: true }).fill('missing');
    await page.getByText('No owner listings match your filters.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
    if (width === 390) await page.screenshot({ path: '../owner-mobile.png', fullPage: true });
    if (width === 1024) await page.screenshot({ path: '../owner-tablet.png', fullPage: true });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete Owner Test Property', exact: true }).filter({ visible: true }).click();
    await page.getByText('No owner listings yet. Add your first owner listing.', { exact: true }).waitFor();
    console.log(`PASS owner CRUD, reload, dropdowns and layout at ${width}x${height}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await page.goto('http://127.0.0.1:3000');
  const renewal = page.locator('select[title="Click to change renewal status"]');
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/listings/1') && response.request().method() === 'PATCH'), renewal.selectOption('Want to be renew')]);
  await page.clock.fastForward(45000);
  assert.equal(await renewal.inputValue(), 'Want to be renew');
  assert.equal(listing.renewStatus, 'Want to be renew');
  await page.reload();
  await renewal.waitFor();
  assert.equal(await renewal.inputValue(), 'Want to be renew');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS renewal choice survives 45 seconds of automatic checks and reload');
} finally { await browser.close(); await postgres.close(); }
