// Run with npm run preview:integrated; all records are synthetic and disposable.
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const base='http://127.0.0.1:4176';
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
const data=async(path:string)=>(await(await fetch(base+'/api/'+path)).json()).data;
async function create(propertyName:string,type:'rent'|'sale'){
 const response=await fetch(base+'/api/owner-listings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ownerName:'Not captured',noTel:'Not captured',propertyName,propertyType:'landed',propertyPrice:'500000',location:'Ampang',status:'Unlisted',transactionType:type})});assert.equal(response.status,201);return(await response.json()).data;
}
try{
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:900});
  const suffix=width+' '+Date.now(),rental=await create('Report Rental '+suffix,'rent'),sale=await create('Report Sale '+suffix,'sale'),manual=await create('Manual Property '+suffix,'rent');
  const report=`SUMMARY LISTING OCTOBER 2026\n*15/10/2026*\n1. WTL-202610-${width===390?'00390':'01280'}\n- Name Example Rental\n- Contact:019-0000001\n- Property: ${rental.propertyName}\n2. WTS-202610-${width===390?'00390':'01280'}\n- Name: Example Sale\n- Contact:019-0000002\n- Property: ${sale.propertyName}\n3. WTL-202610-${width===390?'00391':'01281'}\n- Name: Pending Owner\n- Contact:019-0000003\n- Property: Unmatched report entry ${suffix}`;
  await page.goto(base);await page.getByRole('button',{name:'Master Listing Owner',exact:true}).click();
  await page.getByRole('button',{name:'Paste listing report',exact:true}).click();let modal=page.getByRole('dialog');
  await modal.getByLabel('Listing report',{exact:true}).fill(report);await modal.getByRole('button',{name:'Preview report',exact:true}).click();
  await modal.getByLabel('Owner match for row 1').waitFor();
  assert.equal(await modal.getByLabel('Owner match for row 1').inputValue(),String(rental.id));assert.equal(await modal.getByLabel('Owner match for row 3').inputValue(),'');
  await fetch(base+'/__preview/fail-next-save',{method:'POST'});await modal.getByRole('button',{name:'Apply matched listings',exact:true}).click();await modal.getByRole('alert').waitFor();
  assert.equal(await modal.getByLabel('Owner match for row 1').inputValue(),String(rental.id),'Failure preserves selections');
  assert.equal((await data('owner-listings')).find((r:any)=>r.id===rental.id).status,'Unlisted');
  await modal.getByRole('button',{name:'Apply matched listings',exact:true}).click();await modal.getByRole('status').filter({hasText:'2 applied'}).waitFor();
  const normal=await data('listings'),r=normal.find((l:any)=>l.property===rental.propertyName),s=normal.find((l:any)=>l.property===sale.propertyName);
  assert.equal(r.projectCategory,'Rental');assert.equal(s.projectCategory,'Subsale Direct Listing (SSDL)');assert.ok(r.notes.includes('Example Rental'));assert.ok(r.notes.includes('WTL-202610-'));assert.equal(r.date,'');
  const owners=await data('owner-listings');assert.equal(owners.find((r:any)=>r.id===rental.id).seedingStatus,'Contacted');assert.equal(owners.find((r:any)=>r.id===sale.id).status,'Listed');
  await modal.getByLabel('Search existing owners for row 3').fill(manual.propertyName);await modal.getByLabel('Owner match for row 3').selectOption(String(manual.id));
  await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/summary-report')&&r.request().method()==='POST'),modal.getByRole('button',{name:'Save pending changes',exact:true}).click()]);await expect(modal.getByRole('button',{name:'Save pending changes',exact:true})).toBeEnabled();
  await modal.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'Paste listing report',exact:true}).click();modal=page.getByRole('dialog');
  await modal.getByRole('button').filter({hasText:'1 pending / 3 rows'}).first().click();await modal.getByLabel('Owner match for row 3').waitFor();
  assert.equal(await modal.getByLabel('Owner match for row 3').inputValue(),String(manual.id),'Saved manual match survives closing');
  await modal.getByRole('button',{name:'Apply matched listings',exact:true}).click();await modal.getByRole('status').filter({hasText:'3 applied'}).waitFor();
  assert.equal((await data('listings')).filter((r:any)=>[rental.propertyName,sale.propertyName,manual.propertyName].includes(r.property)).length,3);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await modal.getByRole('button',{name:'Close dialog',exact:true}).click();
 }
 assert.deepEqual(errors,[]);console.log('PASS summary UI mobile/desktop preview, failed-save draft retention, Contacted/Listed routing and durable manual pending matches');
}finally{await browser.close();}
