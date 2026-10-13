// Run against scripts/local-publications-preview.ts: synthetic, disposable data only.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const base='http://127.0.0.1:4176';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage();
const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
const owners=async()=> (await (await fetch(base+'/api/owner-listings')).json()).data;
const listings=async()=> (await (await fetch(base+'/api/listings')).json()).data;
try {
 for(const width of [390,1280]) {
  await page.setViewportSize({width,height:900});
  const property='Promotion UI '+width+' '+Date.now();
  const created=await fetch(base+'/api/owner-listings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ownerName:'Sample owner',noTel:'012345',propertyName:property,propertyType:'landed',propertyPrice:'400000',location:'Ampang',status:'Unlisted'})});
  assert.equal(created.status,201);
  await page.goto(base);
  await page.getByRole('button',{name:'Master Listing Owner',exact:true}).click();
  await page.getByRole('textbox',{name:'Search owner listings'}).fill(property);
  await page.getByRole('button',{name:property,exact:true}).click();
  const modal=page.getByRole('dialog');
  await modal.getByLabel('Status',{exact:true}).selectOption('Listed');
  const destination=modal.getByLabel('Where should this listing be appended?');
  await destination.waitFor();
  assert.equal(await modal.getByRole('button',{name:'Save follow-up',exact:true}).isDisabled(),true);
  await destination.selectOption('sale');
  await Promise.all([page.waitForResponse(r=>r.url().includes('/api/owner-listings/')&&r.request().method()==='GET'),modal.getByRole('button',{name:'Save follow-up',exact:true}).click()]);
  assert.equal((await owners()).find((r:any)=>r.propertyName===property).transactionType,'sale');
  assert.equal((await listings()).filter((r:any)=>r.property===property).length,1);
  assert.equal((await listings()).find((r:any)=>r.property===property).projectCategory,'Subsale Direct Listing (SSDL)');
  await modal.getByRole('button',{name:'Edit property',exact:true}).click();
  const form=page.getByRole('dialog');
  assert.equal(await form.getByLabel('Where should this listing be appended?').count(),0);
  assert.ok((await form.innerText()).includes('Subsale Direct Listing'));
  await form.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'+ Add owner listing',exact:true}).click();
  const add=page.getByRole('dialog');
  await add.getByLabel('Status',{exact:true}).selectOption('Listed');
  await add.getByLabel('Where should this listing be appended?').selectOption('rent');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await add.getByRole('button',{name:'Cancel',exact:true}).click();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS mobile/desktop category prompt, blocked missing choice, persisted selection, linked row creation and owner edit/add forms');
} finally {await browser.close();}
