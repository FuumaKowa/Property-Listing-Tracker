import React,{useState} from 'react';
import {ArrowRight,CheckCircle2,Video} from 'lucide-react';
import {currentPublication,publicationPackage,workflowChannels} from '../../workflow/model';
import {Badge,MaterialPreview,type PanelProps} from './shared';

export function ReviewApprovalPanel({listing:w,busy,onAction,onDirty}:PanelProps){
  const current=w.materials.filter(m=>!m.replacedBy);
  const [channelIds,setChannelIds]=useState<string[]>(()=>w.destinations.length||w.destinationSelectionSaved?w.destinations.map(d=>d.channelId):[]);
  const [materialIds,setMaterialIds]=useState<string[]>(()=>current.filter(m=>!m.original&&(m.review==='approved'||(m.review==='submitted'&&m.kind!=='video'))).map(m=>m.id));
  const chosen=current.filter(m=>!m.original&&materialIds.includes(m.id)&&['submitted','approved'].includes(m.review));
  const pendingChannels=channelIds.filter(id=>!w.destinations.find(d=>d.channelId===id)?.approval);
  const ready=pendingChannels.filter(id=>publicationPackage(id,chosen).length>0);
  const waiting=pendingChannels.length-ready.length;
  const locked=w.destinations.filter(d=>d.publications.length>0).map(d=>d.channelId);
  const sameChoices=(w.destinationSelectionSaved||w.destinations.length>0)&&JSON.stringify([...channelIds].sort())===JSON.stringify(w.destinations.map(d=>d.channelId).sort());
  const blocked=!w.brief.permission?'Owner permission is required.':!w.handedOffAt?'Eypa needs to send the brief to production first.':w.brief.tasks.some(t=>!t.done)?'Resolve the required checks in the owner brief before publishing.':'';
  const changeChannels=(ids:string[])=>{setChannelIds(ids);onDirty(true,'review-platforms');};
  async function approve(){if(await onAction({type:'approveForPublishing',channelIds,materialIds:chosen.map(m=>m.id)})){onDirty(false,'review-platforms');onDirty(false,'review-materials');}}
  async function save(){if(await onAction({type:'setDestinations',channelIds}))onDirty(false,'review-platforms');}
  return <section className="wf-review-workspace" aria-label="Select publishing platforms">
    <div className="wf-bulk-approval-bar">
      <div><h3>Choose publishing platforms</h3><p><strong>{ready.length} ready for publishing</strong>{waiting>0&&` · ${waiting} waiting for materials`}{channelIds.length>pendingChannels.length&&` · ${channelIds.length-pendingChannels.length} already sent`}</p></div>
      <button className="wf-button wf-primary" disabled={busy||!!blocked||!ready.length} onClick={approve}><CheckCircle2 size={17}/> Send selected platforms to publishing <ArrowRight size={17}/></button>
      <p className="wf-bulk-approval-help">{blocked||(!ready.length?(pendingChannels.length?'Select prepared copywriting and visual materials below.':'Choose platforms to send, or continue with the platforms already selected.'):'Muz selects the prepared materials and platforms to publish. A selected platform remains pending until its required materials are ready.')}</p>
    </div>
    <div className="wf-review-columns">
      <div className="wf-panel">
        <div className="wf-review-section-title"><span>1</span><div><h3>Select platforms</h3><p>Tick the platforms Muz will publish to. Unticked platforms are excluded.</p></div></div>
        <div className="wf-checklist-controls"><span>{channelIds.length} of {workflowChannels.length} selected</span><button className="wf-button" disabled={busy} onClick={()=>changeChannels(workflowChannels.map(c=>c.id))}>Select all platforms</button><button className="wf-button" disabled={busy} onClick={()=>changeChannels(locked)}>Clear platforms</button></div>
        <div className="wf-channel-checklist">{workflowChannels.map(c=>{
          const selected=channelIds.includes(c.id),d=w.destinations.find(d=>d.channelId===c.id),published=d&&currentPublication(d),readyHere=publicationPackage(c.id,chosen).length>0;
          const label=!selected?'Excluded':published?'Published':d?.approval?'Already sent':readyHere?'Ready to send':c.video?'Waiting for video + copy':'Waiting for visual + copy';
          return <label key={c.id} className={`wf-channel-option ${selected?'is-selected':'is-excluded'}`}><input type="checkbox" aria-label={`Publish on ${c.name}`} checked={selected} disabled={busy||locked.includes(c.id)} onChange={e=>changeChannels(e.target.checked?[...channelIds,c.id]:channelIds.filter(id=>id!==c.id))}/><span><strong>{c.name}</strong><small className={selected&&readyHere&&!d?.approval?'wf-ready-label':''}>{label}{locked.includes(c.id)?' · history retained':''}</small></span>{c.video&&<Video size={14}/>}</label>;
        })}</div>
        <div className="wf-platform-save"><p>Save choices now if materials are still being prepared.</p><button className="wf-button" disabled={busy||sameChoices} onClick={save}>Save platform choices</button></div>
      </div>
      <div className="wf-panel">
        <div className="wf-review-section-title"><span>2</span><div><h3>Choose materials</h3><p>Owner originals and prepared assets appear together. Originals are for reference; select prepared materials to publish. Video platforms need a video and copy.</p></div></div>
        {!current.length&&<p className="wf-empty-small">No owner or prepared materials have been added yet.</p>}
        <div className="wf-review-materials">{current.map(m=>{
          const eligible=!m.original&&['submitted','approved'].includes(m.review),selected=materialIds.includes(m.id)&&eligible;
          return <article className={`wf-material-card ${selected?'wf-selected':''}`} key={m.id}>
            <label className="wf-material-heading"><input type="checkbox" aria-label={`Use ${m.title}`} checked={selected} disabled={busy||!eligible} onChange={e=>{setMaterialIds(ids=>e.target.checked?[...ids,m.id]:ids.filter(id=>id!==m.id));onDirty(true,'review-materials');}}/><div><h4>{m.title}</h4><span>{m.kind} · version {m.revision}</span></div><Badge tone={m.original?'slate':eligible?'green':'slate'}>{m.original?'Owner original':eligible?'Ready for Muz':'Not submitted'}</Badge></label>
          <MaterialPreview material={m} compact/>
            {!eligible&&!m.original&&<p className="wf-material-wait">{m.review==='changes'?'Luqman needs to revise and send this material.':'Luqman needs to submit this material to Muz.'}</p>}{m.original&&<p className="wf-material-wait">Owner-supplied reference asset. Prepared materials are selected for publishing.</p>}
          </article>;
        })}</div>
      </div>
    </div>
  </section>;
}
