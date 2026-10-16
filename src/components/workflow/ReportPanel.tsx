import React,{useState} from 'react';
import {Copy,CheckCircle2,MessageCircle} from 'lucide-react';
import {ownerReport,allPublished,canWork,currentPublication,reportSignature} from '../../workflow/model';
import {Badge,timeLabel,type PanelProps} from './shared';
export function ReportPanel({listing:w,session,busy,onAction}:PanelProps){
  const [feedback,setFeedback]=useState(''),report=ownerReport(w),complete=allPublished(w),canSend=canWork(session.effective,w,'coordinator');
  const published=w.destinations.filter(d=>currentPublication(d)).length,alreadySent=w.sentReports.some(r=>r.signature===reportSignature(w));
  async function copy(){try{await navigator.clipboard.writeText(report);setFeedback('Report copied.');}catch{setFeedback('Select and copy the report text below. Clipboard access is unavailable.');}}
  return <div className="wf-report-layout"><div className="wf-panel"><div className="wf-destination-heading"><div><h3>Report for the owner</h3><p>Generated from the publishing checklist and saved links.</p></div><Badge tone={complete?'green':'amber'}>{complete?'Complete report':'Interim report'}</Badge></div><textarea className="wf-report-text" aria-label="Generated owner report" readOnly value={report} rows={30}/></div>
    <div className="wf-stack"><div className="wf-panel"><h3>{published} of {w.destinations.length} destinations completed</h3><p className="wf-hint">{complete?'All selected destinations are complete. Eypa can send the final update.':'The report shows pending destinations explicitly. Eypa can send an interim update while work continues.'}</p><button className="wf-button wf-primary wf-full" onClick={copy}><Copy size={16}/> Copy report</button>{w.brief.whatsapp&&<a className="wf-button wf-full" href={w.brief.whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={16}/> Open owner WhatsApp</a>}{feedback&&<p role="status" className="wf-hint">{feedback}</p>}
      {canSend&&<div className="wf-send-confirmation"><p>After you have sent this report to the owner, record it here.</p><button className="wf-button wf-full" disabled={busy||!published||alreadySent||!w.brief.permission} onClick={()=>onAction({type:'sent'})}><CheckCircle2 size={16}/> {alreadySent?'This report is marked sent':complete?'Mark final report sent':'Mark interim report sent'}</button></div>}
    </div>
    <div className="wf-panel"><h3>Owner update history</h3>{!w.sentReports.length&&<p className="wf-empty-small">No owner updates recorded yet.</p>}{w.sentReports.map((r,i)=><details className="wf-sent-record" key={r.at+i}><summary><Badge tone={r.final?'green':'amber'}>{r.final?'Final':'Interim'}</Badge><span>{timeLabel(r.at)}<small>Sent by {r.by}</small></span></summary><pre>{r.text}</pre></details>)}</div></div>
  </div>;
}
