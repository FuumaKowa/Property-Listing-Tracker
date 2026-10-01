import {useState} from 'react';
import type {PropertyListing} from '../types';
import type {ListingPublication,PublicationChannel} from '../publications';
import {buildPublicationReport} from '../reportExport';

export function PublicationReportExport({listing,links,channels}:{listing:PropertyListing;links:ListingPublication[];channels:PublicationChannel[]}){
 const [report,setReport]=useState<string|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 return <section className="mb-5">
  <button type="button" className="ui-button" onClick={()=>{setReport(buildPublicationReport(listing,links,channels));setNotice('');}}>Export report</button>
  {report!==null&&<div className="mt-3 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
   <h3 className="font-semibold">Copy publication report</h3>
   <p className="text-xs text-slate-600">Includes saved links and category labels. Empty categories show N/A. Contact details come from Lister; add a price or verified owner details here if needed. Editing this report does not change the property.</p>
   <label className="ui-label">Report text<textarea aria-label="Publication report text" className="ui-input mt-1 min-h-72 font-mono text-sm" value={report} onChange={e=>{setReport(e.target.value);setNotice('');}}/></label>
   <div className="flex flex-wrap gap-2">
    <button type="button" className="ui-button ui-primary" disabled={busy} onClick={async()=>{setBusy(true);setNotice('');try{await navigator.clipboard.writeText(report);setNotice('Report copied.');}catch{setNotice('Clipboard access is unavailable. Select the report text and copy it manually.');}finally{setBusy(false);}}}>Copy report</button>
    <button type="button" className="ui-button" onClick={()=>{const url=URL.createObjectURL(new Blob([report],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`property-${listing.id}-publication-report.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Download .txt</button>
    <button type="button" className="ui-button" onClick={()=>{setReport(null);setNotice('');}}>Close report</button>
   </div>
   {notice&&<p role="status" className="text-sm text-slate-700">{notice}</p>}
  </div>}
 </section>;
}
