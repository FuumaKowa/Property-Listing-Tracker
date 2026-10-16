import React,{useEffect,useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import type {WorkflowListing} from '../../workflow/model';
export function LinkedWorkflowDetails({listingId,ownerId}:{listingId?:number;ownerId?:number}){
 const {workflowEnabled}=useAuth(),[workflow,setWorkflow]=useState<WorkflowListing|null>(null),[error,setError]=useState('');
 useEffect(()=>{setWorkflow(null);setError('');if(!workflowEnabled)return;let active=true;void(async()=>{try{const session=await fetch('/api/workflow/session');if(!session.ok)return;const r=await fetch(`/api/workflow/listing-link?listingId=${listingId||0}&ownerId=${ownerId||0}`);if(!r.ok)throw new Error('Workflow details could not be loaded.');const data=await r.json();if(active)setWorkflow(data.listing);}catch(e){if(active)setError((e as Error).message);}})();return()=>{active=false;};},[workflowEnabled,listingId,ownerId]);
 if(error)return <p className="mt-4 text-sm text-amber-700">{error}</p>;if(!workflow)return null;
 const b=workflow.brief,materials=workflow.materials.filter(m=>!m.replacedBy&&!m.original&&m.review==='approved');
 return <section className="my-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Marketing workflow · {b.reference}</h3><a className="text-sm text-indigo-700 underline" href={`/workflow?id=${workflow.id}`}>Open workflow</a></div>
  <p className="mt-2 text-sm">Owner: {b.ownerName||'Pending'} · {b.phone||'Contact pending'}</p>{b.price&&<p className="text-sm">Asking price: {b.price}</p>}
  {b.details&&<p className="mt-2 whitespace-pre-wrap text-sm">{b.details}</p>}
  {b.sourceUrl&&<a className="mr-4 text-sm text-indigo-700 underline" href={b.sourceUrl} target="_blank" rel="noreferrer">Original listing</a>}{b.whatsapp&&<a className="text-sm text-indigo-700 underline" href={b.whatsapp} target="_blank" rel="noreferrer">Owner WhatsApp</a>}
  {materials.length>0&&<details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Approved materials ({materials.length})</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{materials.map(m=><div key={m.id} className="rounded border border-indigo-100 bg-white p-3"><strong className="text-sm">{m.title} · v{m.revision}</strong>{m.kind==='copy'?<p className="mt-2 whitespace-pre-wrap text-sm">{m.text}</p>:<a className="mt-2 block text-sm text-indigo-700 underline" href={`/api/workflow/files/${m.fileKey}?download=1`}>Download {m.kind}</a>}</div>)}</div></details>}
 </section>;
}
