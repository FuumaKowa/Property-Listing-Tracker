// Run Vite on port 3000, then: npm install --no-save --no-package-lock @playwright/test
// Run: node scripts/responsive-check.mjs (requires Microsoft Edge). All API data is mocked.
﻿import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel:'msedge', headless:true});
const page = await browser.newPage();
const listing = {id:1,property:'Responsive test property with a long name',projectCategory:'Project Marketing (PM)',location:'Kuala Lumpur',tenure:'Freehold Malay Reserved',pm:'Test Team',availableUnits:'12',status:'Active',date:'2099-12-31',renewStatus:'Renewed'};
await page.route('**/api/**', route => {
 const path = new URL(route.request().url()).pathname;
 const body = path === '/api/auth/me' ? {authenticated:true,user:{id:1,username:'tester',displayName:'Responsive Tester',role:'super_admin'}} : {data:path === '/api/listings' ? [listing] : []};
 return route.fulfill({json:body});
});
async function fits(label) {
 const size = await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert(size.scroll <= size.width + 1,`${label}: horizontal overflow ${JSON.stringify(size)}`);
}
for (const [width,height] of [[320,568],[375,667],[390,844],[667,375],[768,1024],[1024,768],[1440,900],[1920,1080]]) {
 await page.setViewportSize({width,height});
 await page.goto('http://127.0.0.1:3000');
 await page.getByRole('button',{name:'Add Row',exact:true}).waitFor();
 await fits(`workspace ${width}`);
 await page.getByTitle('Toggle Summary Metrics Panel').click();
 await fits(`metrics ${width}`);
 if(width < 768) {
  await page.getByRole('button',{name:'Edit listing',exact:true}).waitFor();
  await page.getByLabel('Select all',{exact:true}).check();
  await fits(`batch ${width}`);
  await page.getByRole('button',{name:'Deselect',exact:true}).click();
  await page.getByPlaceholder('Search properties, locations, or PMs...').fill('no-match');
  await page.getByText('No listings match your filters.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Reset Filters',exact:true}).click();
 } else {
  const scroll = await page.getByRole('region',{name:'Property listings spreadsheet'}).evaluate(el=>{el.scrollLeft=el.scrollWidth;return {left:el.scrollLeft,width:el.clientWidth,total:el.scrollWidth};});
  assert(scroll.total <= scroll.width || scroll.left > 0,'Spreadsheet cannot scroll');
 }
 for(const trigger of ['Create a new property listing entry','Manage users','View who updated listings and timestamp audit history']) {
  await page.getByTitle(trigger,{exact:true}).click();
  await page.locator('.modal-panel').waitFor();
  await fits(`dialog ${trigger} ${width}`);
  const box=await page.locator('.modal-panel').boundingBox();
  assert(box.y >= 0 && box.y+box.height <= height+1,`dialog exceeds viewport ${width}x${height}`);
  await page.keyboard.press('Escape');
  await page.goto('http://127.0.0.1:3000');
  await page.getByRole('button',{name:'Add Row',exact:true}).waitFor();
 }
 console.log(`PASS ${width}x${height}`);
}
await browser.close();
