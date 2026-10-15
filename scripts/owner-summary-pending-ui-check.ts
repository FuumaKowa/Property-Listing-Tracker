import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const base=process.env.REPORT_PREVIEW_URL||'http://127.0.0.1:4184';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900}}),nonce=Date.now(),ref=String(nonce).slice(-5),dup=String(nonce+1).slice(-5);
  const owners=[];for(const name of ['Ready','Blocked']){const r=await fetch(base+'/api/owner-listings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ownerName:'Not captured',noTel:'Not captured',propertyName:`${name} pending test ${nonce}`,propertyType:'landed',propertyPrice:'500000',status:'Unlisted',transactionType:'rent'})});assert.equal(r.status,201);owners.push((await r.json()).data);}
  const report=`*15/10/2026*\n1. WTL-202610-${ref}\n- Name: Fictional Ready Owner\n- Contact: 012-${ref}111\n- Property: ${owners[0].propertyName}\n2. WTL-202610-${dup}\n- Name: Fictional Blocked Owner\n- Contact: 013-${ref}222\n- Property: ${owners[1].propertyName}\n3. WTL-202610-${dup}\n- Name: Fictional Other Owner\n- Contact: 014-${ref}333\n- Property: Other pending test ${nonce}\n4. WTL202610${ref}\n- Name: Fictional Malformed Reference\n- Contact: 015-${ref}444\n- Property: Malformed reference test ${nonce}`;
  await page.goto(base);await page.getByRole('button',{name:'Master Listing Owner',exact:true}).click();await page.getByRole('button',{name:'Paste listing report',exact:true}).click();let modal=page.getByRole('dialog');await modal.getByLabel('Listing report',{exact:true}).fill(report);await modal.getByRole('button',{name:'Preview report',exact:true}).click();await modal.getByLabel('Owner match for row 2').selectOption(String(owners[1].id));
  await modal.getByRole('button',{name:'Save pending changes',exact:true}).click();await expect(modal.getByRole('button',{name:'Save pending changes',exact:true})).toBeEnabled();await modal.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'Paste listing report',exact:true}).click();modal=page.getByRole('dialog');await modal.getByRole('button').filter({hasText:'4 pending / 4 rows'}).first().click();await expect(modal.getByLabel('Owner match for row 2')).toHaveValue(String(owners[1].id));
  await modal.getByRole('button',{name:'Apply matched listings',exact:true}).click();await modal.getByRole('status').filter({hasText:/Applied 1 listing/}).waitFor();
  const notice=modal.getByRole('status').filter({hasText:/Applied 1 listing/});await expect(notice).toBeInViewport();const latest=(await(await fetch(base+'/api/owner-listings')).json()).data;assert.equal(latest.find((o:any)=>o.id===owners[0].id).status,'Listed',JSON.stringify({width,expected:owners.map(o=>({id:o.id,property:o.propertyName})),notice:await notice.textContent()}));assert.equal((await(await fetch(base+'/api/owner-listings')).json()).data.find((o:any)=>o.id===owners[1].id).status,'Unlisted');await expect(modal.getByLabel('Owner match for row 2')).toHaveValue(String(owners[1].id));
  await expect(modal.getByRole('button',{name:'Apply matched listings',exact:true})).toBeDisabled();await page.close();
 }
 console.log('PASS saved pending report applies valid matches, defers duplicates, preserves choices and displays feedback beside actions on mobile/desktop');
}finally{await browser.close();}
