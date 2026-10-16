import React,{useState} from 'react';
import {CheckCircle2,ExternalLink,LockKeyhole,Send} from 'lucide-react';
import {ReviewApprovalPanel} from './ReviewApprovalPanel';
import {canWork,currentPublication,workflowChannels,type Destination} from '../../workflow/model';
import {Badge,MaterialPreview,MaterialDownload,timeLabel,type PanelProps} from './shared';

function DestinationCard({destination:d,...props}:PanelProps&{destination:Destination}){
  const {listing:w,session,busy,onAction,onDirty}=props,c=workflowChannels.find(c=>c.id===d.channelId)!;
  const reviewer=canWork(session.effective,w,'reviewer'),publisher=canWork(session.effective,w,'publisher');
  const [url,setUrl]=useState(''),[note,setNote]=useState(''),[reason,setReason]=useState('');
  const publication=currentPublication(d),oldPublication=!publication?d.publications[0]:undefined;
  const selectedMaterials=w.materials.filter(m=>d.approval?.materialIds.includes(m.id));
  const status=d.blocked?'Blocked':publication?'Published':d.approval?'Ready to publish':'Awaiting approval';
  return <article className="wf-panel wf-destination" aria-label={c.name}>
    <div className="wf-destination-heading"><div><h3>{c.name}</h3><p>{c.completion==='done'?'Completion record':'Published ad link'} · {c.video?'Video + copywriting':'Visual + copywriting'}</p></div><Badge tone={publication?'green':d.blocked?'red':d.approval?'indigo':'amber'}>{status}</Badge></div>
    {oldPublication&&<div className="wf-callout wf-warning"><div><strong>Previous publication retained</strong><p>The materials changed. Review the new package and update the advertisement.</p>{oldPublication.url&&<a href={oldPublication.url} target="_blank" rel="noreferrer" className="wf-text-link">Previous ad <ExternalLink size={13}/></a>}</div></div>}
    {d.approval&&<details className="wf-package" open={publisher||undefined}><summary><LockKeyhole size={15}/> Approved package · {selectedMaterials.length} materials<span>{d.approval.by} · {timeLabel(d.approval.at)}</span></summary><div className="wf-approved-grid">{selectedMaterials.map(m=><div key={m.id}><strong>{m.title} <small>v{m.revision}</small></strong><MaterialPreview material={m} compact/><MaterialDownload material={m}/></div>)}</div></details>}
    {publication&&<div className="wf-published"><CheckCircle2 size={20}/><div><strong>{c.completion==='done'?'Completed':'Published'}</strong>{publication.url&&<a href={publication.url} target="_blank" rel="noreferrer">{publication.url} <ExternalLink size={13}/></a>}<small>{publication.by} · {timeLabel(publication.at)}</small>{publication.note&&<p>{publication.note}</p>}</div></div>}
    {d.blocked&&<p className="wf-error">Blocked: {d.blocked}</p>}
    {publisher&&d.approval&&!publication&&<form className="wf-publish-form" onSubmit={async e=>{e.preventDefault();if(await onAction({type:'publish',channelId:d.channelId,url,note})){setUrl('');setNote('');onDirty(false,`publication:${d.channelId}`);}}}>
      {c.completion==='link'&&<label className="wf-label">Published ad URL<input type="url" required placeholder="https://..." value={url} onChange={e=>{setUrl(e.target.value);onDirty(true,`publication:${d.channelId}`);}}/></label>}
      <label className="wf-label">Publication note (optional)<input value={note} onChange={e=>{setNote(e.target.value);onDirty(true,`publication:${d.channelId}`);}} placeholder={c.completion==='done'?'Broadcast audience / confirmation':'Any publication details'}/></label>
      <button className="wf-button wf-primary" disabled={busy||!w.brief.permission}><Send size={15}/> {c.completion==='done'?'Mark completed':'Save published link'}</button>
      <details className="wf-block"><summary>Unable to publish?</summary><label className="wf-label">Block reason<input value={reason} onChange={e=>{setReason(e.target.value);onDirty(true,`block:${d.channelId}`);}} placeholder="Explain what is needed"/></label><button type="button" className="wf-button" disabled={busy||!reason.trim()} onClick={async()=>{if(await onAction({type:'block',channelId:d.channelId,note:reason})){setReason('');onDirty(false,`block:${d.channelId}`);}}}>Record blocker</button></details>
    </form>}
    {!d.approval&&!reviewer&&<p className="wf-hint">Dr Shahril needs to approve the materials for this destination before publishing can begin.</p>}
  </article>;
}
export function PlatformsPanel(props:PanelProps){
  const {listing:w,session}=props,reviewer=canWork(session.effective,w,'reviewer');
  return <div className="wf-stack">
    {reviewer?<ReviewApprovalPanel {...props}/>:<div className="wf-callout"><CheckCircle2 size={22}/><div><strong>Publish the approved destinations</strong><p>Each ready destination has its approved material package. Video can follow when its approval is ready.</p></div></div>}
    {!w.destinations.length&&!reviewer&&<div className="wf-empty"><Send size={32}/><h3>Publishing destinations are waiting for review</h3><p>Dr Shahril selects the platforms and sends the approved package to publishing.</p></div>}
    {reviewer&&w.destinations.length>0?<details className="wf-approved-progress"><summary>View approved packages and publishing progress ({w.destinations.length})</summary><div className="wf-stack">{w.destinations.map(d=><DestinationCard {...props} key={d.channelId} destination={d}/>)}</div></details>:w.destinations.map(d=><DestinationCard {...props} key={d.channelId} destination={d}/>)}
  </div>;
}
