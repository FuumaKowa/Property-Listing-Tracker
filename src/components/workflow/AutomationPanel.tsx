import React,{useState} from 'react';
import {CheckCircle2,Upload,Play,RefreshCw,Square,Image,Film,FileText} from 'lucide-react';
import {canWork} from '../../workflow/model';
import {productionActive,productionProblems,type ProductionProvider} from '../../workflow/production';
import {Badge,MaterialDownload,MaterialPreview,type PanelProps} from './shared';

export function AutomationPanel({listing:w,session,busy,onAction,onDirty,onUploadMany}:PanelProps){
  const editable=canWork(session.effective,w,'coordinator'),job=w.production,active=productionActive(w),available=session.production?.enabled;
  const [mode,setMode]=useState<ProductionProvider>(job?.provider||(session.production?.openaiReady?'openai':'template'));
  const [files,setFiles]=useState<File[]>([]),[uploadError,setUploadError]=useState('');
  const photos=w.materials.filter(m=>m.original&&!m.replacedBy&&m.kind==='photo');
  const problems=productionProblems(w),finished=w.materials.filter(m=>m.productionId===job?.id&&!m.replacedBy);
  async function upload(){if(!onUploadMany)return;const result=await onUploadMany(files);setFiles(files.slice(result));if(result===files.length){onDirty(false);setUploadError('');}else setUploadError(`${result} photos saved. Remaining files are still selected; retry the upload.`);}
  async function start(){if(await onAction({type:'startProduction',provider:mode}))onDirty(false);}
  return <div className="wf-stack">
    <div className="wf-panel wf-auto-intro"><div><p className="wf-eyebrow">EYPA → AUTOMATIC PRODUCTION → MUZ</p><h2>Prepare the publishing package</h2><p>Upload original photos and start production. Prepared materials go to Muz, who selects the publishing platforms.</p></div><Badge tone="green">No reviewer approval gate</Badge></div>
    {!available&&<div className="wf-callout"><p>Automatic production is not connected on this server yet. Your brief and materials remain saved.</p></div>}
    {job&&<section className={`wf-panel wf-auto-status wf-auto-${job.status}`} aria-live="polite"><div className="wf-inline"><Badge tone={job.status==='complete'?'green':job.status==='failed'?'red':'blue'}>{job.status}</Badge><strong>{job.stage}</strong></div><p>{job.provider==='openai'?'AI-assisted copy · template media':'Template copy · template media'} · Requested by {job.requestedBy}</p>{job.error&&<p className="wf-error">{job.error}</p>}{active&&editable&&<button className="wf-button" disabled={busy} onClick={()=>onAction({type:'cancelProduction'})}><Square size={14}/> Cancel production</button>}{job.status==='complete'&&<p className="wf-success"><CheckCircle2 size={18}/> Muz can download the materials and record published links under Platforms.</p>}</section>}
    {editable&&!active&&<div className="wf-brief-grid">
      <section className="wf-panel"><h3>1. Original photographs</h3><p className="wf-hint">Upload up to 12 JPEG, PNG or WebP photos, 30 MB each. The source photos are preserved.</p>
        <div className="wf-auto-photos">{photos.map(m=><div key={m.id}><MaterialPreview material={m} compact/><small>{m.title}</small></div>)}</div>
        <label className="wf-label">Choose photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||!available} onChange={e=>{const next=Array.from(e.target.files||[]);setUploadError('');if(next.length+photos.length>12){setUploadError('Choose up to 12 photos in total.');e.target.value='';return;}setFiles(next);onDirty(next.length>0);}}/></label>
        {files.length>0&&<button className="wf-button" disabled={busy} onClick={upload}><Upload size={16}/>{busy?'Saving photos…':`Save ${files.length} photos`}</button>}{uploadError&&<p className="wf-error" role="alert">{uploadError}</p>}
        <h3>2. Production mode</h3><label className="wf-label">Copywriting<select value={mode} disabled={busy} onChange={e=>{setMode(e.target.value as ProductionProvider);onDirty(true);}}><option value="template">Templates — no API key needed</option><option value="openai" disabled={!session.production?.openaiReady}>OpenAI-assisted — {session.production?.openaiReady?'key configured':'API setup needed'}</option></select></label>
        <p className="wf-hint">Both modes create prepared photographs, portrait and square posters, a silent video montage, portal copy, a social caption and WhatsApp copy. OpenAI arranges supplied facts; it does not invent property details.</p>
        {!session.production?.openaiReady&&<details><summary>Connect OpenAI</summary><p className="wf-hint">Daniel: create a project and API key in the <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">OpenAI dashboard</a>, enable API billing, then run the local setup helper. Keep the key out of reports and chat. Restart the preview after setup.</p></details>}
      </section>
      <section className="wf-panel"><h3>3. Send to Muz</h3><p className="wf-hint">Once production is complete, Muz chooses which platforms get the listing. No platform will be selected or published automatically.</p>
        {problems.length>0&&<div className="wf-callout"><div><strong>Complete the intake</strong><ul>{problems.map(p=><li key={p}>{p}</li>)}</ul><p className="wf-hint">Update listing facts and required checks under Brief.</p></div></div>}
        <button className="wf-button wf-primary" disabled={busy||!available||!!problems.length||!!files.length} onClick={start}>{job?<RefreshCw size={17}/>:<Play size={17}/>} {job?'Generate a new package':'Generate & send to Muz'}</button>
      </section>
    </div>}
    {finished.length>0&&<section className="wf-panel"><h3>Publishing materials</h3><div className="wf-auto-results">{finished.map(m=><article key={m.id}><h4>{m.kind==='copy'?<FileText size={16}/>:m.kind==='video'?<Film size={16}/>:<Image size={16}/>} {m.title}</h4><MaterialPreview material={m} compact/><MaterialDownload material={m}/>{m.text&&<button className="wf-button" onClick={()=>{void navigator.clipboard.writeText(m.text!).catch(()=>{});}}>Copy text</button>}</article>)}</div></section>}
    {editable&&job&&!active&&<section className="wf-panel"><h3>Need a manual revision?</h3><p>Return this listing to the existing production and review workflow. Its materials, ad links and activity remain saved.</p><button className="wf-button" disabled={busy} onClick={async()=>{if(await onAction({type:'manualProduction'}))onDirty(false);}}>Continue manually</button></section>}
  </div>;
}
