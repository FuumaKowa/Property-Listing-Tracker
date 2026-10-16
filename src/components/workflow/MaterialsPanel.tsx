import React,{useState} from 'react';
import {Upload,Check,Send,MessageSquare,FolderOpen} from 'lucide-react';
import {canWork,type MaterialKind,type Material} from '../../workflow/model';
import {Badge,MaterialPreview,MaterialDownload,timeLabel,type PanelProps} from './shared';

function MaterialCard({m,selectable,checked,toggle}:{m:Material;selectable?:boolean;checked?:boolean;toggle?:()=>void}){
  return <article className={`wf-material-card ${checked?'wf-selected':''}`}>
    <div className="wf-material-heading">{selectable&&<input type="checkbox" aria-label={`Select ${m.title}`} checked={checked} onChange={toggle}/>}<div><h4>{m.title}</h4><span>{m.kind} · version {m.revision}</span></div><Badge tone={m.review==='approved'?'green':m.review==='submitted'?'amber':m.review==='changes'?'red':'slate'}>{m.original?'Original':m.review==='changes'?'Changes requested':m.review}</Badge></div>
    <MaterialPreview material={m}/>
    {m.note&&<p className="wf-review-note"><MessageSquare size={14}/> {m.note}</p>}
    <div className="wf-material-footer"><span>{m.by} · {timeLabel(m.at)}</span><MaterialDownload material={m}/></div>
  </article>;
}
export function MaterialsPanel({listing:w,session,busy,onAction,onUpload,onDirty}:PanelProps){
  const producer=canWork(session.effective,w,'producer'),coordinator=canWork(session.effective,w,'coordinator'),reviewer=canWork(session.effective,w,'reviewer');
  const [kind,setKind]=useState<MaterialKind>('photo'),[title,setTitle]=useState(''),[text,setText]=useState(''),[file,setFile]=useState<File|null>(null),[original,setOriginal]=useState(!producer),[replacement,setReplacement]=useState(''),[selected,setSelected]=useState<string[]>([]),[note,setNote]=useState(''),[error,setError]=useState(''),[uploadKey,setUploadKey]=useState(0);
  const current=w.materials.filter(m=>!m.replacedBy),past=w.materials.filter(m=>m.replacedBy);
  const toggle=(id:string)=>setSelected(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);
  const forSubmit=selected.filter(id=>current.some(m=>m.id===id&&['draft','changes'].includes(m.review)&&!m.original));
  const forReview=selected.filter(id=>current.some(m=>m.id===id&&m.review==='submitted'));
  async function upload(e:React.FormEvent){e.preventDefault();setError('');if(!title.trim()){setError('Give this material a title.');return;}
    let ok=false;
    if(kind==='copy')ok=await onAction({type:'addMaterial',kind,title,text,original,replacesId:replacement||undefined});
    else if(file)ok=await onUpload!(file,{kind,title,original,replacesId:replacement||undefined});else{setError('Choose a file to upload.');return;}
    if(ok){setTitle('');setText('');setFile(null);setReplacement('');setUploadKey(n=>n+1);onDirty(false,'material-draft');}
  }
  async function review(approved:boolean){setError('');if(!approved&&!note.trim()){setError('Add a comment explaining the requested changes.');return;}if(await onAction({type:'review',ids:forReview,approved,note})){setSelected([]);setNote('');onDirty(false,'review-note');}}
  return <div className="wf-stack">
    <div className="wf-callout"><FolderOpen size={21}/><div><strong>Every version stays with the listing</strong><p>Originals, drafts and approved materials are kept together. Replacing an approved version sends its affected platforms back for approval.</p></div></div>
    {(producer||coordinator)&&<form className="wf-panel" onSubmit={upload}><h3><Upload size={18}/> Add material</h3>
      <div className="wf-form-three"><label className="wf-label">Material type<select value={kind} onChange={e=>{setKind(e.target.value as MaterialKind);setReplacement('');setFile(null);onDirty(true,'material-draft');}}><option value="photo">Photo</option><option value="poster">Poster</option><option value="video">Video</option><option value="copy">Copywriting</option></select></label>
        <label className="wf-label">Title<input required value={title} maxLength={200} onChange={e=>{setTitle(e.target.value);onDirty(true,'material-draft');}} placeholder="Living room / Facebook caption"/></label>
        <label className="wf-label">Version<select value={replacement} onChange={e=>{const m=current.find(m=>m.id===e.target.value);setReplacement(e.target.value);if(m){setTitle(m.title);setText(m.text||'');}onDirty(true,'material-draft');}}><option value="">New material</option>{current.filter(m=>m.kind===kind&&m.original===original).map(m=><option key={m.id} value={m.id}>Replace {m.title} (v{m.revision})</option>)}</select></label></div>
      {kind==='copy'?<label className="wf-label">Copywriting<textarea required rows={6} value={text} onChange={e=>{setText(e.target.value);onDirty(true,'material-draft');}} placeholder="Write the proposed advertisement here…"/></label>:<label className="wf-upload-label">Choose {kind} file<input key={uploadKey} type="file" accept={kind==='video'?'video/mp4,video/webm':'image/jpeg,image/png,image/webp'} onChange={e=>{setFile(e.target.files?.[0]||null);onDirty(true,'material-draft');}}/><small>JPEG, PNG, WebP, MP4 or WebM · up to 30 MB · saved in the local preview bucket</small></label>}
      <div className="wf-form-footer"><label className="wf-check"><input type="checkbox" checked={original} disabled={!producer} onChange={e=>{setOriginal(e.target.checked);setReplacement('');onDirty(true,'material-draft');}}/><span>Original supplied by owner</span></label><button className="wf-button wf-primary" disabled={busy||(!original&&!w.handedOffAt)} type="submit">{busy?'Saving…':kind==='copy'?'Save copywriting':'Upload material'}</button></div>
      {!original&&!w.handedOffAt&&<p className="wf-hint">Eypa needs to send the brief to production first.</p>}
    </form>}
    {error&&<p className="wf-error" role="alert">{error}</p>}
    {(producer||reviewer)&&current.some(m=>!m.original)&&<div className="wf-review-toolbar"><div><strong>{selected.length} selected</strong><span>Select materials below to submit or review them together.</span></div>
      {producer&&<button className="wf-button wf-primary" disabled={busy||!forSubmit.length} onClick={async()=>{if(await onAction({type:'submit',ids:forSubmit}))setSelected([]);}}><Send size={15}/> Submit selected for review</button>}
      {reviewer&&<><input aria-label="Review comment" placeholder="Review comment (required for changes)" value={note} onChange={e=>{setNote(e.target.value);onDirty(true,'review-note');}}/><button className="wf-button" disabled={busy||!forReview.length} onClick={()=>review(false)}>Request changes</button><button className="wf-button wf-primary" disabled={busy||!forReview.length} onClick={()=>review(true)}><Check size={16}/> Approve selected materials</button></>}
    </div>}
    {!current.length&&<div className="wf-empty"><Upload size={32}/><h3>No materials yet</h3><p>Add the owner's originals or start preparing the marketing package.</p></div>}
    <div className="wf-material-grid">{current.filter(m=>!m.original).map(m=><MaterialCard key={m.id} m={m} selectable={(producer&&['draft','changes'].includes(m.review))||(reviewer&&m.review==='submitted')} checked={selected.includes(m.id)} toggle={()=>toggle(m.id)}/>)}</div>
    {current.some(m=>m.original)&&<><h3 className="wf-subheading">Owner's original materials</h3><div className="wf-material-grid">{current.filter(m=>m.original).map(m=><MaterialCard key={m.id} m={m}/>)}</div></>}
    {!!past.length&&<details className="wf-panel"><summary>Previous versions ({past.length})</summary><div className="wf-material-grid">{past.map(m=><MaterialCard key={m.id} m={m}/>)}</div></details>}
  </div>;
}
