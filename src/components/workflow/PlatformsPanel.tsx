import React,{useState} from 'react';
import {CheckCircle2,ExternalLink,LockKeyhole,Send} from 'lucide-react';
import {ReviewApprovalPanel} from './ReviewApprovalPanel';
import {canWork,currentPublication,workflowChannels,type Destination} from '../../workflow/model';
import {productionActive} from '../../workflow/production';
import {Badge,MaterialPreview,MaterialDownload,timeLabel,type PanelProps} from './shared';

function DestinationCard({destination:d,...props}:PanelProps&{destination:Destination}){
  const {listing:w,session,busy,onAction,onDirty}=props,c=workflowChannels.find(c=>c.id===d.channelId)!;
  const publisher=canWork(session.effective,w,'publisher');
  const [url,setUrl]=useState(''),[note,setNote]=useState(''),[reason,setReason]=useState('');
  const publication=currentPublication(d),oldPublication=!publication?d.publications[0]:undefined;
  const selectedMaterials=w.materials.filter(m=>d.approval?.materialIds.includes(m.id));
  const status=d.blocked?'Blocked':publication?'Published':d.approval?'Ready to publish':'Awaiting materials';
  return <article className="wf-panel wf-destination" aria-label={c.name}>
    <div className="wf-destination-heading"><div><h3>{c.name}</h3><p>{c.completion==='done'?'Completion record':'Published ad link'} · {c.video?'Video + copywriting':'Visual + copywriting'}</p></div><Badge tone={publication?'green':d.blocked?'red':d.approval?'indigo':'amber'}>{status}</Badge></div>
    {oldPublication&&<div className="wf-callout wf-warning"><div><strong>Previous publication retained</strong><p>The materials changed. Muz can update the advertisement with the new package.</p>{oldPublication.url&&<a href={oldPublication.url} target="_blank" rel="noreferrer" className="wf-text-link">Previous ad <ExternalLink size={13}/></a>}</div></div>}
    {d.approval&&<details className="wf-package" open={publisher||undefined}><summary><LockKeyhole size={15}/> Approved package · {selectedMaterials.length} materials<span>{d.approval.by} · {timeLabel(d.approval.at)}</span></summary><div className="wf-approved-grid">{selectedMaterials.map(m=><div key={m.id}><strong>{m.title} <small>v{m.revision}</small></strong><MaterialPreview material={m} compact/><MaterialDownload material={m}/></div>)}</div></details>}
    {publication&&<div className="wf-published"><CheckCircle2 size={20}/><div><strong>{c.completion==='done'?'Completed':'Published'}</strong>{publication.url&&<a href={publication.url} target="_blank" rel="noreferrer">{publication.url} <ExternalLink size={13}/></a>}<small>{publication.by} · {timeLabel(publication.at)}</small>{publication.note&&<p>{publication.note}</p>}</div></div>}
    {d.blocked&&<p className="wf-error">Blocked: {d.blocked}</p>}
    {publisher&&d.approval&&!publication&&<form className="wf-publish-form" onSubmit={async e=>{e.preventDefault();if(await onAction({type:'publish',channelId:d.channelId,url,note})){setUrl('');setNote('');onDirty(false,`publication:${d.channelId}`);}}}>
      {c.completion==='link'&&<label className="wf-label">Published ad URL<input type="url" required placeholder="https://..." value={url} onChange={e=>{setUrl(e.target.value);onDirty(true,`publication:${d.channelId}`);}}/></label>}
      <label className="wf-label">Publication note (optional)<input value={note} onChange={e=>{setNote(e.target.value);onDirty(true,`publication:${d.channelId}`);}} placeholder={c.completion==='done'?'Broadcast audience / confirmation':'Any publication details'}/></label>
      <button className="wf-button wf-primary" disabled={busy||!w.brief.permission}><Send size={15}/> {c.completion==='done'?'Mark completed':'Save published link'}</button>
      <details className="wf-block"><summary>Unable to publish?</summary><label className="wf-label">Block reason<input value={reason} onChange={e=>{setReason(e.target.value);onDirty(true,`block:${d.channelId}`);}} placeholder="Explain what is needed"/></label><button type="button" className="wf-button" disabled={busy||!reason.trim()} onClick={async()=>{if(await onAction({type:'block',channelId:d.channelId,note:reason})){setReason('');onDirty(false,`block:${d.channelId}`);}}}>Record blocker</button></details>
    </form>}
    {!d.approval&&<p className="wf-hint">Choose prepared materials and send this platform to publishing when its required assets are ready.</p>}
  </article>;
}
export function PlatformsPanel(props:PanelProps){
  const {listing:w,session}=props,publisher=canWork(session.effective,w,'publisher'),producing=productionActive(w);
  return <div className="wf-stack">
    {publisher&&!producing?<ReviewApprovalPanel {...props}/>:<div className="wf-callout"><CheckCircle2 size={22}/><div><strong>{producing?'Production is preparing the package':'Publishing package for Muz'}</strong><p>{producing?'Muz can select platforms when production finishes.':'Prepared materials go directly to Muz. He selects the platforms, publishes the ads and saves each live link here.'}</p></div></div>}
    {!w.destinations.length&&(!publisher||producing)&&<div className="wf-empty"><Send size={32}/><h3>Ready for Muz’s platform selection</h3><p>Prepared materials are available automatically after Luqman sends them.</p></div>}
    {w.destinations.map(d=><DestinationCard {...props} key={d.channelId} destination={d}/>)}
  </div>;
}
