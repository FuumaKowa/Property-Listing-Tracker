import React,{useEffect,useState} from 'react';
import {ModalFrame} from './ModalFrame';
import {fetchArchivedListings,restoreListing} from '../../services/api';
import type {PropertyListing} from '../../types';
import {creatorLabel} from '../../utils/listingPresentation';
export function ArchiveModal({onClose,onRestored}:{onClose:()=>void;onRestored:()=>Promise<void>}){
 const [rows,setRows]=useState<PropertyListing[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState<number|null>(null),[search,setSearch]=useState('');
 async function load(){setLoading(true);setError('');try{setRows(await fetchArchivedListings());}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 async function restore(row:PropertyListing){setBusy(row.id);setError('');try{await restoreListing(row.id,row.version);setRows(prev=>prev.filter(p=>p.id!==row.id));await onRestored();}catch(e){setError((e as Error).message);}finally{setBusy(null);}}
 return <ModalFrame title="Archived properties" subtitle="Restore a property with its details, published ads, and history intact." onClose={onClose}>
  <div className="flex gap-2 mb-4"><input aria-label="Search archived properties" className="ui-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search archived properties…"/><button className="ui-button" disabled={busy!==null} onClick={load}>Refresh archive</button></div>
  {error&&<p role="alert" className="mb-3 text-sm text-rose-700">{error}</p>}
  {loading?<p>Loading archive…</p>:rows.length===0?<p className="text-slate-500">No archived properties.</p>:<div className="space-y-3">{rows.filter(r=>(r.property+' '+r.projectCategory).toLowerCase().includes(search.toLowerCase())).map(row=><article className="rounded-xl border border-slate-200 p-4" key={row.id}>
   <h3 className="font-semibold">{row.property}</h3><p className="text-sm text-slate-500">{row.projectCategory} · {row.location}</p><p className="text-sm">Lister: {row.pm} · PIC: {creatorLabel(row)}</p>
   <p className="mt-2 text-xs text-slate-500">Archived by {row.archivedByName||'Team member'}{row.archivedAt?' · '+new Date(row.archivedAt).toLocaleString():''}</p>
   <button className="ui-button mt-3" disabled={busy!==null} onClick={()=>restore(row)}>{busy===row.id?'Restoring…':'Restore property'}</button>
  </article>)}</div>}
 </ModalFrame>;
}
