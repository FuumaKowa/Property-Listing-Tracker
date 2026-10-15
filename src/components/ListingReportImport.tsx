import {useState} from 'react';
import {ModalFrame} from './Modals/ModalFrame';
import {PROJECT_CATEGORIES,type ProjectCategory,type PropertyListing} from '../types';
import type {ListingReportPreview} from '../listingReport';
import type {PublicationChannel} from '../publications';
export function ListingReportImport({defaultCategory,listings,onClose,onImported}:{defaultCategory:ProjectCategory|'All';listings:PropertyListing[];onClose:()=>void;onImported:()=>void}){
 const [text,setText]=useState(''),[preview,setPreview]=useState<ListingReportPreview|null>(null),[channels,setChannels]=useState<PublicationChannel[]>([]),[listingId,setListingId]=useState(''),[category,setCategory]=useState<ProjectCategory|''>(''),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [links,setLinks]=useState<{url:string;label:string;channelId:number;selected:boolean}[]>([]);
 async function request(body:object){const response=await fetch('/api/listings/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let result;try{result=await response.json();}catch{throw new Error('Unable to access listing reports. Please retry.');}if(!response.ok)throw new Error(result.error||'Unable to import report.');return result.data;}
 async function open(){setBusy(true);setError('');setMessage('');try{
  const channelResponse=await fetch('/api/publication-channels');const result=await channelResponse.json();if(!channelResponse.ok)throw new Error(result.error||'Unable to load publication channels.');
  const p:ListingReportPreview=await request({mode:'preview',report:text});setPreview(p);setChannels(result.data||[]);setSearch('');
  const target=p.candidates.find(c=>c.id===p.selectedListingId);setListingId(target?String(target.id):p.candidates.length?'':'new');
  setCategory(target?.projectCategory||p.category||(defaultCategory==='All'?'':defaultCategory));
  setLinks(p.links.filter(l=>l.url&&!l.issue).map(l=>({url:l.url!,label:l.label,channelId:l.channelId||0,selected:!!l.channelId})));
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const candidates=[...(preview?.candidates||[]),...listings.filter(l=>search.trim()&&[l.property,l.location,l.agent].join(' ').toLowerCase().includes(search.toLowerCase())).slice(0,20)].filter((l,i,a)=>a.findIndex(c=>c.id===l.id)===i);
 const selected=links.filter(l=>l.selected&&l.channelId);
 async function apply(){if(!preview||!listingId||!category)return;setBusy(true);setError('');try{
  const target=candidates.find(c=>c.id===Number(listingId));const result=await request({mode:'commit',report:text,listingId:listingId==='new'?null:Number(listingId),createNew:listingId==='new',version:target?.version,category,links:selected.map(({url,label,channelId})=>({url,label,channelId}))});
  setMessage(`Listing #${result.listingId} saved · ${result.added} advertisement links added. ${listingId==='new'?'Missing details are pending; open Edit to complete them.':''}`);setPreview(null);setText('');onImported();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <ModalFrame title="Paste property report" subtitle="Match a listing or create one with pending details, and import its published ads." onClose={()=>{if(!busy)onClose();}}>
  <div className="min-w-0 space-y-4">
   {error&&<p role="alert" className="break-words text-rose-700">{error}</p>}{message&&<p role="status" className="rounded bg-green-50 p-3 text-green-800">{message}</p>}
   <label className="ui-label">Property report<textarea aria-label="Property report" className="ui-input mt-1 min-h-44" maxLength={50000} value={text} disabled={busy||!!preview} onChange={e=>setText(e.target.value)} placeholder="Paste one property report with its reference, details and advertisement links"/></label>
   {!preview?<button className="ui-button ui-primary" disabled={busy||!text.trim()} onClick={()=>void open()}>{busy?'Working…':'Preview property report'}</button>:<>
    <p className="break-words font-semibold">{preview.property}</p><p className="text-sm">{preview.reference||'No reference supplied'} · {preview.ownerName||'Owner pending'} · {preview.phone||'Contact pending'}{preview.price?` · RM${preview.price}`:''}</p>
    {preview.issue&&<p className="text-sm text-amber-800">{preview.issue}</p>}
    <label className="ui-label">Search existing listings<input className="ui-input mt-1" value={search} disabled={busy} onChange={e=>setSearch(e.target.value)} placeholder="Property name, location or owner"/></label>
    <label className="ui-label">Listing match<select aria-label="Listing match" className="ui-input mt-1" disabled={busy} value={listingId} onChange={e=>{setListingId(e.target.value);const l=candidates.find(c=>c.id===Number(e.target.value));if(l?.projectCategory)setCategory(l.projectCategory);}}>
     <option value="">Choose a listing</option>{!preview.candidates.length&&<option value="new">Create new — pending details</option>}{candidates.map(l=><option key={l.id} value={l.id}>{l.property} · {l.projectCategory}{l.archivedAt?' (restore archived listing)':''}</option>)}
    </select></label>
    <label className="ui-label">Destination category<select aria-label="Destination category" className="ui-input mt-1" disabled={busy||listingId!=='new'} value={category} onChange={e=>setCategory(e.target.value as ProjectCategory)}><option value="">Choose category</option>{PROJECT_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
    <p className="text-sm text-slate-600">{listingId==='new'?'A new row will have Pending status. Complete the missing details using Edit.':'Existing property details and schedules are preserved. Report information is added to Notes.'}</p>
    <p className="text-sm">{links.length} usable links · {preview.links.length-links.length} blank, N/A or invalid entries skipped. Done entries remain in the report notes.</p>
    <div className="space-y-3">{links.map((l,index)=><div className="min-w-0 rounded border p-3" key={index}>
     <label className="flex gap-2 text-sm"><input type="checkbox" disabled={busy||!l.channelId} checked={l.selected} onChange={e=>setLinks(previous=>previous.map((r,i)=>i===index?{...r,selected:e.target.checked}:r))}/><span className="break-words">{l.label}</span></label>
     <p className="my-2 break-all text-xs text-slate-500">{l.url}</p>
     <select aria-label={`Publication channel ${index+1}`} className="ui-input w-full" value={l.channelId} disabled={busy} onChange={e=>setLinks(previous=>previous.map((r,i)=>i===index?{...r,channelId:Number(e.target.value),selected:!!Number(e.target.value)}:r))}><option value={0}>Choose a publication channel</option>{channels.filter(c=>!c.archivedAt).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
    </div>)}</div>
    <p className="text-xs text-slate-500">Duplicate URLs are skipped. Unselected links remain in Notes for later completion.</p>
    <div className="flex flex-wrap gap-2"><button className="ui-button ui-primary" disabled={busy||!listingId||!category} onClick={()=>void apply()}>{busy?'Importing…':`Import listing and ${selected.length} links`}</button><button className="ui-button" disabled={busy} onClick={()=>setPreview(null)}>Edit report</button></div>
   </>}
  </div>
 </ModalFrame>;
}
