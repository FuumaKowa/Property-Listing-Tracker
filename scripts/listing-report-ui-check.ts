import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const base=process.env.REPORT_PREVIEW_URL||'http://127.0.0.1:4180';
const browser=await chromium.launch({channel:'msedge',headless:true});
const data=async(path:string)=>(await(await fetch(base+'/api/'+path)).json()).data;
try{
 const channels=await data('publication-channels');if(!channels.some((c:any)=>c.name==='Facebook')){const r=await fetch(base+'/api/publication-channels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Facebook'})});assert.equal(r.status,201);}
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900}}),suffix=Date.now().toString().slice(-5),property=`UI Sample Terrace ${suffix}`;
  await page.goto(base);await page.getByRole('button',{name:'Rental',exact:true}).click();await page.getByRole('button',{name:'Paste property report',exact:true}).click();let modal=page.getByRole('dialog');
  const report=`FOR RENT | ${property} • RM1,500\nREF: WTL-202610-${suffix}\n* Name: Fictional Contact\n* Contact: 012-0000001\n1. Telegram : https://t.me/sample/${suffix}\n14 Facebook Profile Sample : https://www.facebook.com/share/p/${suffix}/\n20. Whatsapp Broadcast : Done`;
  await modal.getByLabel('Property report',{exact:true}).fill(report);await modal.getByRole('button',{name:'Preview property report',exact:true}).click();await expect(modal.getByLabel('Listing match')).toHaveValue('new');await expect(modal.getByLabel('Destination category')).toHaveValue('Rental');
  await fetch(base+'/__preview/fail-next-save',{method:'POST'});await modal.getByRole('button',{name:/Import listing and/}).click();await modal.getByRole('alert').waitFor();await expect(modal.getByLabel('Property report',{exact:true})).toHaveValue(report);
  await modal.getByRole('button',{name:/Import listing and/}).click();await modal.getByRole('status').filter({hasText:/saved/}).waitFor();
  const listing=(await data('listings')).find((l:any)=>l.property===property);assert(listing);assert.equal(listing.status,'Pending');assert.equal(listing.projectCategory,'Rental');assert.ok(listing.notes.includes('RM1,500'));assert.ok(listing.notes.includes('Done'));
  const ads=await data(`listings/${listing.id}/publications`);assert.equal(ads.length,2);
  // Same report finds its reference and keeps one property and two links.
  await modal.getByLabel('Property report',{exact:true}).fill(report);await modal.getByRole('button',{name:'Preview property report',exact:true}).click();await expect(modal.getByLabel('Listing match')).toHaveValue(String(listing.id));await modal.getByRole('button',{name:/Import listing and/}).click();await modal.getByRole('status').filter({hasText:/0 advertisement links added/}).waitFor();assert.equal((await data('listings')).filter((l:any)=>l.property===property).length,1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await modal.getByRole('button',{name:'Close dialog',exact:true}).click();
  // The owner summary automatically offers creation, which can still be kept pending.
  await page.getByRole('button',{name:'Master Listing Owner',exact:true}).click();await page.getByRole('button',{name:'Paste listing report',exact:true}).click();modal=page.getByRole('dialog');
  await modal.getByLabel('Listing report',{exact:true}).fill(`*15/10/2026*\n1. WTS-202610-${suffix}\n- Name: Fictional New Owner\n- Contact: 019-${suffix}123\n- Property: Missing UI Owner ${suffix}`);await modal.getByRole('button',{name:'Preview report',exact:true}).click();
  const create=modal.getByRole('checkbox',{name:'Create missing owner and category row — details pending'});await expect(create).toBeChecked();await create.uncheck();await expect(modal.getByRole('button',{name:'Apply matched listings',exact:true})).toBeDisabled();await create.check();await modal.getByRole('button',{name:'Apply matched listings',exact:true}).click();await modal.getByRole('status').filter({hasText:'1 applied'}).waitFor();
  const owner=(await data('owner-listings')).find((o:any)=>o.propertyName===`Missing UI Owner ${suffix}`);assert(owner);assert.equal(owner.propertyPrice,'');assert.equal(owner.propertyType,'pending');assert.equal(owner.status,'Listed');assert.equal(owner.seedingStatus,'Contacted');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.close();
 }
 console.log('PASS mobile/desktop property report create/match/ads/retry/failure retention and missing owner creation');
}finally{await browser.close();}
