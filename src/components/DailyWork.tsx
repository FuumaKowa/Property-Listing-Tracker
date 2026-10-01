import {useEffect,useState} from 'react';
import type {PropertyListing} from '../types';
import type {SessionUser} from '../context/AuthContext';
import {fetchPublicationSummaries} from '../services/publications';
import {dataWarnings,isMine,malaysiaToday,remindersFor,type WarningKey} from '../utils/dailyWork';
import {ModalFrame} from './Modals/ModalFrame';
import {formatCalendarDate} from '../utils/datePresentation';

export function DataWarnings({listing,count,onIgnore}:{listing:PropertyListing;count?:number;onIgnore:(row:PropertyListing,key:WarningKey,ignore:boolean)=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const warnings=dataWarnings(listing,count);
 return <section className="my-4 rounded-xl border border-slate-200 bg-white p-4">
  <h3 className="font-semibold">Data completeness</h3>
  <p className="mt-1 text-xs text-slate-500">Ignore is shared with the team. It hides this warning until restored; property data stays unchanged.</p>
  {warnings.every(w=>w.ignored)&&<p className="mt-3 text-sm text-emerald-700">No outstanding data warnings.</p>}
  <ul className="mt-3 space-y-2">{warnings.filter(w=>!w.ignored).map(w=><li key={w.key} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-amber-800">{w.label}</span><button className="ui-button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onIgnore(listing,w.key,true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Ignore</button></li>)}</ul>
  {warnings.some(w=>w.ignored)&&<details className="mt-3 text-sm text-slate-500"><summary className="cursor-pointer">Ignored warnings ({warnings.filter(w=>w.ignored).length})</summary><ul className="mt-2 space-y-2">{warnings.filter(w=>w.ignored).map(w=><li key={w.key} className="flex flex-wrap items-center justify-between gap-2"><span>{w.label}</span><button className="ui-button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onIgnore(listing,w.key,false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Restore warning</button></li>)}</ul></details>}

  {error&&<p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
 </section>;
}

export function DailyWork({listings,user,onOpen,publicationVersion,onIgnore}:{listings:PropertyListing[];user:SessionUser;onOpen:(id:number)=>void;publicationVersion:number;onIgnore:(row:PropertyListing,key:WarningKey,ignore:boolean)=>Promise<void>}){
 const [open,setOpen]=useState(false),[scope,setScope]=useState('mine'),[tab,setTab]=useState('today');
 const [counts,setCounts]=useState<Record<number,number>>({}),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [today,setToday]=useState(malaysiaToday);
 useEffect(()=>{const timer=setInterval(()=>setToday(malaysiaToday()),60000);return()=>clearInterval(timer);},[]);
 const ids=listings.map(l=>l.id).join(',');
 useEffect(()=>{let active=true;setCounts({});setError('');fetchPublicationSummaries(ids?ids.split(',').map(Number):[]).then(rows=>{if(active)setCounts(Object.fromEntries(ids.split(',').filter(Boolean).map(id=>[Number(id),rows.find(r=>r.listingId===Number(id))?.count||0])));}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[ids,publicationVersion,retry]);
 const scoped=listings.filter(l=>!l.archivedAt&&(scope==='all'||isMine(l,user)));
 const live=scoped.filter(l=>l.status!=='Sold Out');
 const reminders=live.flatMap(row=>remindersFor(row,today).map(reminder=>({row,...reminder}))).sort((a,b)=>a.days-b.days);
 const priorities=live.filter(l=>l.isPriority);
 const incomplete=live.filter(l=>dataWarnings(l,counts[l.id]).some(w=>!w.ignored));
 const openProperty=(id:number)=>{setOpen(false);onOpen(id);};
 return <>
  <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 text-sm">
   <button className="ui-button font-semibold text-indigo-700" onClick={()=>{setTab('today');setOpen(true);}}>My work today</button>
   <button className="text-amber-800 underline" onClick={()=>{setTab('reminders');setOpen(true);}}>{reminders.length} reminders</button>
   <span className="text-xs text-slate-500">{scope==='mine'?'My properties':'All team'} · {formatCalendarDate(today)} · Malaysia time</span>
  </div>
  {open&&<ModalFrame title="My work today" subtitle="Priority properties, schedules and missing details across all normal listing sheets." onClose={()=>setOpen(false)}>
   <div className="mb-4 flex flex-wrap gap-2">
    <select className="ui-input max-w-48" aria-label="Work scope" value={scope} onChange={e=>setScope(e.target.value)}><option value="mine">My properties</option><option value="all">All team</option></select>
    {(['today','reminders','data'] as const).map(key=><button key={key} aria-pressed={tab===key} className={`ui-button ${tab===key?'bg-indigo-100 text-indigo-800':''}`} onClick={()=>setTab(key)}>{key==='today'?`Priorities (${priorities.length})`:key==='reminders'?`Reminders (${reminders.length})`:`Missing data (${incomplete.length})`}</button>)}
   </div>
   <p className="mb-4 text-xs text-slate-500">Upcoming dates cover the next 7 days. Sold and archived properties are excluded. Missing years need confirmation before reminders can be calculated.</p>
   {error&&<p role="alert" className="mb-3 text-rose-700">Publication counts unavailable. Link warnings are paused. <button className="underline" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>}
   {tab==='today'&&<><h3 className="mb-3 font-semibold">Your focus list</h3>{priorities.length===0&&<p className="text-sm text-slate-500">No priority properties in this view. Use the star beside a property to mark it.</p>}{priorities.map(row=><div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4" key={row.id}><button className="text-left font-semibold text-indigo-800 underline" onClick={()=>openProperty(row.id)}>{row.property}</button><p className="mt-1 text-xs text-slate-500">{row.projectCategory} · {row.location}</p><p className="mt-2 text-sm text-amber-800">{remindersFor(row,today).map(r=>r.label).join(' · ')||'No schedule due in the next 7 days'}</p></div>)}<h3 className="my-3 font-semibold">Due and upcoming</h3></>}
   {(tab==='today'||tab==='reminders')&&(reminders.length?reminders.map(r=><div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3" key={`${r.row.id}-${r.kind}`}><button className="text-left text-sm font-medium underline" onClick={()=>openProperty(r.row.id)}>{r.row.property}</button><span className={`text-sm ${r.days<0?'text-rose-700':'text-amber-800'}`}>{r.label}</span></div>):<p className="text-sm text-slate-500">No due or upcoming reminders in this view.</p>)}
   {tab==='data'&&<>{live.length===0&&<p>No properties in this view.</p>}{live.filter(row=>dataWarnings(row,counts[row.id]).length>0).map(row=><div key={row.id}><button className="mt-3 text-left font-semibold text-indigo-700 underline" onClick={()=>openProperty(row.id)}>{row.property}</button><DataWarnings listing={row} count={counts[row.id]} onIgnore={onIgnore}/></div>)}</>}
  </ModalFrame>}
 </>;
}
