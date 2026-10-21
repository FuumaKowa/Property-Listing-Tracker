import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';

const port='4197',base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',port,'--strictPort'],{cwd:process.cwd(),stdio:'pipe',windowsHide:true});
let output='';server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  let ready=false;for(let attempt=0;attempt<60;attempt++){try{if((await fetch(base+'/')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
  assert.ok(ready,output);
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.goto(`${base}/?preview=iclick`);
  await expect(page.getByRole('button',{name:'Hide search and filters'})).toBeVisible();
  await page.getByLabel('Search listings').fill('Tangerine');
  await expect(page.getByRole('button',{name:/Tangerine Suites/})).toBeVisible();
  await expect(page.getByRole('button',{name:/Laman Seri/})).toHaveCount(0);
  await page.getByLabel('Search listings').fill('');
  await page.getByLabel('Listing completeness').selectOption('incomplete');
  await expect(page.getByText(/3 of 3 sample listings/)).toBeVisible();
  await page.getByLabel('Listing completeness').selectOption('all');
  await page.getByLabel('Listing category').selectOption('Rental');
  await expect(page.getByRole('button',{name:/Suria Jelutong/})).toBeVisible();
  await expect(page.getByRole('button',{name:/Laman Seri/})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Tangerine Suites',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Hide search and filters'}).click();
  await expect(page.getByLabel('Search listings')).toHaveCount(0);
  await page.getByRole('button',{name:'Show search and filters'}).click();
  await expect(page.getByLabel('Search listings')).toBeVisible();
  await page.close();
  console.log('PASS IClick workspace search, completeness/category filters, and collapsible controls');
}finally{await browser.close();if(server.exitCode===null){server.kill();await Promise.race([new Promise(resolve=>server.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,1500))]);}}
