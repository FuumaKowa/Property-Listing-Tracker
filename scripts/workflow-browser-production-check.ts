import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';

const port='4198',base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',port,'--strictPort'],{cwd:process.cwd(),stdio:'pipe',windowsHide:true});
let output='';server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
 assert.ok(ready,output);
 const page=await browser.newPage();page.on('console',message=>console.log('BROWSER',message.text()));await page.goto(base);
 const result=await page.evaluate(async()=>{
  const {renderPosterTemplates,createMarketingCopy}=await import('/src/workflow/browser-production.ts');
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;
  const context=canvas.getContext('2d')!;context.fillStyle='#557d8c';context.fillRect(0,0,800,600);
  const photo=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('canvas produced no source image')),'image/jpeg',.9));
  console.log('SOURCE',Object.prototype.toString.call(photo),photo?.constructor?.name,photo instanceof Blob,photo?.size);
  const brief={category:'Rental',property:'Sample Suites',location:'Sepang, Selangor',price:'RM1,600 / month',reference:'WTL-202610-00016',details:'Bedrooms: 2\nBathrooms: 1\nFully furnished',ownerName:'Private Owner',phone:'012-0000000'};
  const posters=await renderPosterTemplates(brief,[photo],'tangerine-editorial');
  const copies=createMarketingCopy(brief);
  const output=[] as Array<{name:string;type:string;size:number;width:number;height:number;footer:number[];cta:number[]}>;
  for(const poster of posters){const file=poster.file;const url=URL.createObjectURL(file);try{const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('generated poster cannot be decoded'));image.src=url;});const probe=document.createElement('canvas');probe.width=img.naturalWidth;probe.height=img.naturalHeight;const ctx=probe.getContext('2d')!;ctx.drawImage(img,0,0);const y=img.naturalHeight;const footer=Array.from(ctx.getImageData(20,y-80,1,1).data).slice(0,3),cta=Array.from(ctx.getImageData(20,y-10,1,1).data).slice(0,3);output.push({name:file.name,type:file.type,size:file.size,width:img.naturalWidth,height:img.naturalHeight,footer,cta});}finally{URL.revokeObjectURL(url);}}
  return {posters:output,copies};
 });
 assert.deepEqual(result.posters.map(p=>[p.width,p.height]),[[1080,1440],[1080,1080]]);
 assert.ok(result.posters.every(p=>p.type==='image/jpeg'&&p.size>1000&&p.size<30*1024*1024));
 assert.ok(result.posters.every(p=>p.footer.some((v,i)=>v!==p.cta[i])),'The generated poster must include distinct property-details and CTA bands below its photos.');
 assert.equal(result.copies.length,3);assert.ok(result.copies.every(copy=>copy.includes('RM1,600 / month')&&copy.includes('WTL-202610-00016')));
 assert.ok(result.copies.every(copy=>!copy.includes('Private Owner')&&!copy.includes('012-0000000')),'Marketing copy must not expose the original owner as the agent.');
 console.log('PASS Pages-browser portrait/square poster rendering, details/CTA footer and deterministic copy with no owner PII');
 await page.close();
}finally{await browser.close();if(server.exitCode===null){server.kill();await Promise.race([new Promise(resolve=>server.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,1500))]);}}
