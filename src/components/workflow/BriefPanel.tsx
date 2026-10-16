import React,{useState} from 'react';
import {ClipboardPaste,Plus,ArrowRight,CheckCircle2} from 'lucide-react';
import {canWork,parseBrief,type Brief} from '../../workflow/model';
import type {PanelProps} from './shared';
const emptyBrief:Brief={reference:'',property:'',location:'',category:'Subsale',ownerName:'',phone:'',whatsapp:'',sourceUrl:'',price:'',details:'',raw:'',permission:false,tasks:[]};
interface BriefEditorProps {initial?:Brief;editable:boolean;busy:boolean;onSave:(brief:Brief)=>Promise<boolean>;onDirty:(dirty:boolean)=>void;create?:boolean}
export function BriefEditor({initial=emptyBrief,editable,busy,onSave,onDirty,create}:BriefEditorProps){
  const [draft,setDraft]=useState<Brief>(structuredClone(initial)),[raw,setRaw]=useState(initial.raw),[check,setCheck]=useState(''),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  const edit=(patch:Partial<Brief>)=>{setDraft(d=>({...d,...patch}));onDirty(true);setSaved(false);};
  function extract(){try{const parsed=parseBrief(raw);setDraft(d=>({...d,...parsed}));onDirty(true);setError('');setSaved(false);}catch(e){setError((e as Error).message);}}
  async function save(e:React.FormEvent){e.preventDefault();setError('');if(await onSave({...draft,raw})){onDirty(false);setSaved(true);}}
  return <form onSubmit={save} className="wf-brief-grid">
    <div className="wf-panel">
      <div className="wf-section-title"><ClipboardPaste size={20}/><div><h3>{create?'Start a listing workflow':'Owner briefing'}</h3><p>Paste the handoff report, then check the details below.</p></div></div>
      {editable&&<details className="wf-paste" open={create||undefined}><summary>Paste owner briefing</summary><label className="wf-label">Report text<textarea rows={8} value={raw} onChange={e=>{setRaw(e.target.value);onDirty(true);}} placeholder="REF: WTS-202610-00019&#10;Property: Tanah Sawit&#10;Location: Sungai Besar, Selangor..."/></label><button type="button" className="wf-button" disabled={busy||!raw.trim()} onClick={extract}>Extract details</button><p className="wf-hint">Review the extracted values. Confirm owner permission separately.</p></details>}
      <fieldset disabled={!editable||busy} className="wf-fieldset">
        <div className="wf-form-two">
          <label className="wf-label">Reference<input required maxLength={80} value={draft.reference} onChange={e=>edit({reference:e.target.value})}/></label>
          <label className="wf-label">Listing category<select value={draft.category} onChange={e=>edit({category:e.target.value as Brief['category']})}><option>Subsale</option><option>Rental</option><option>Other</option></select></label>
        </div>
        <label className="wf-label">Property<input required maxLength={300} value={draft.property} onChange={e=>edit({property:e.target.value})}/></label>
        <div className="wf-form-two"><label className="wf-label">Location<input value={draft.location} onChange={e=>edit({location:e.target.value})}/></label><label className="wf-label">Asking price<input placeholder="Pending owner confirmation" value={draft.price} onChange={e=>edit({price:e.target.value})}/></label></div>
        <label className="wf-label">Property details<textarea rows={5} value={draft.details} onChange={e=>edit({details:e.target.value})}/></label>
        <label className="wf-label">Original listing URL<input type="url" value={draft.sourceUrl} onChange={e=>edit({sourceUrl:e.target.value})}/></label>
      </fieldset>
      {!editable&&draft.sourceUrl&&<a className="wf-text-link" href={draft.sourceUrl} target="_blank" rel="noreferrer">Open original listing <ArrowRight size={14}/></a>}
    </div>
    <div className="wf-stack">
      <div className="wf-panel"><h3>Owner & permission</h3><fieldset disabled={!editable||busy} className="wf-fieldset">
        <label className="wf-label">Owner name<input value={draft.ownerName} onChange={e=>edit({ownerName:e.target.value})}/></label>
        <label className="wf-label">Phone number<input value={draft.phone} onChange={e=>edit({phone:e.target.value})}/></label>
        <label className="wf-label">WhatsApp URL<input type="url" placeholder="https://wa.me/..." value={draft.whatsapp} onChange={e=>edit({whatsapp:e.target.value})}/></label>
        <label className="wf-check wf-permission"><input type="checkbox" checked={draft.permission} onChange={e=>edit({permission:e.target.checked})}/><span>Owner has given permission to market this property<small>Required before handing off or publishing.</small></span></label>
      </fieldset></div>
      <div className="wf-panel"><h3>Required checks</h3><p className="wf-hint">Production can start while these are pending. Resolve them before platform approval.</p>
        {draft.tasks.length===0&&<p className="wf-empty-small">No outstanding checks added.</p>}
        {draft.tasks.map(t=><div className="wf-task-row" key={t.id}><label className="wf-check"><input type="checkbox" disabled={!editable||busy} checked={t.done} onChange={e=>edit({tasks:draft.tasks.map(x=>x.id===t.id?{...x,done:e.target.checked}:x)})}/><span>{t.label}</span></label>{editable&&<button type="button" className="wf-icon-button" aria-label={`Remove check ${t.label}`} onClick={()=>edit({tasks:draft.tasks.filter(x=>x.id!==t.id)})}>×</button>}</div>)}
        {editable&&<div className="wf-inline"><input aria-label="New required check" value={check} maxLength={300} onChange={e=>setCheck(e.target.value)} placeholder="Confirm asking price with owner"/><button type="button" className="wf-button" aria-label="Add required check" disabled={!check.trim()||busy} onClick={()=>{edit({tasks:[...draft.tasks,{id:crypto.randomUUID(),label:check.trim(),done:false}]});setCheck('');}}><Plus size={17}/></button></div>}
      </div>
      {editable&&<div className="wf-save-area">{error&&<p role="alert" className="wf-error">{error}</p>}{saved&&<p className="wf-success"><CheckCircle2 size={16}/> Brief saved.</p>}<button type="submit" className="wf-button wf-primary" disabled={busy}>{busy?'Saving…':create?'Create workflow':'Save owner brief'}</button></div>}
    </div>
  </form>;
}
export function BriefPanel(props:PanelProps){
  const {listing:w,session,busy,onAction,onDirty}=props,editable=canWork(session.effective,w,'coordinator');
  const [dirty,setDirty]=useState(false);
  return <><BriefEditor key={w.version} initial={w.brief} editable={editable} busy={busy} onSave={brief=>onAction({type:'saveBrief',brief})} onDirty={d=>{setDirty(d);onDirty(d);}}/>
    {editable&&!w.handedOffAt&&<div className="wf-handoff"><div><h3>Ready for Luqman?</h3><p>Save the brief and confirm owner permission, then send it to production.</p></div><button className="wf-button wf-primary" disabled={busy||dirty||!w.brief.permission} onClick={()=>onAction({type:'handoff'})}>Send to production <ArrowRight size={16}/></button></div>}
  </>;
}
