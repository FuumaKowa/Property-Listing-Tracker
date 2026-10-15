import { useEffect, useRef, useState } from 'react';
import type { OwnerListing } from '../ownerListing';
import type { SummaryCandidate, SummaryPreview, SummaryReportListItem, SummaryRow } from '../ownerSummaryReport';
import {applySummaryReferenceEdits} from '../ownerSummaryReport';
import { useAuth } from '../context/AuthContext';
import { ModalFrame } from './Modals/ModalFrame';
import { commitOwnerSummaryReport, listOwnerSummaryReports, previewOwnerSummaryReport, reopenOwnerSummaryReport } from '../services/ownerSummaryReports';

export function OwnerSummaryReportImport({ owners, onClose, onImported }: { owners: OwnerListing[]; onClose: () => void; onImported: () => void }) {
  const { user } = useAuth();
  const admin = !!user && ['admin', 'super_admin'].includes(user.role);
  const [report, setReport] = useState('');
  const [preview, setPreview] = useState<SummaryPreview | null>(null);
  const [recent, setRecent] = useState<SummaryReportListItem[]>([]);
  const [nextOffset,setNextOffset]=useState<number|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice,setNotice]=useState('');
  const feedback=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(error||notice){feedback.current?.scrollIntoView({block:'nearest'});feedback.current?.focus({preventScroll:true});}},[error,notice]);
  const [searches, setSearches] = useState<Record<number, string>>({});
  const [references, setReferences] = useState<Record<number, string>>({});
  const [manual, setManual] = useState<Record<number, boolean>>({});
  const canEdit = (owner: OwnerListing) => !!user && (admin || owner.assignedAgentId === user.id);
  async function loadRecent(more=false) {
    try { const result=await listOwnerSummaryReports(more?nextOffset||0:0);setRecent(previous=>more?[...previous,...result.reports].filter((value,index,all)=>all.findIndex(other=>other.id===value.id)===index):result.reports);setNextOffset(result.nextOffset); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void loadRecent(); }, []);
  async function open(reportId?: string) {
    setBusy(true); setError('');setNotice('');
    try {
      const next = reportId ? await reopenOwnerSummaryReport(reportId) : await previewOwnerSummaryReport(report);
      setPreview(next); setReferences({}); setSearches({}); setManual({});
      void loadRecent();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const reference = (row: SummaryRow) => (references[row.entry.row] ?? row.entry.reference).trim().toUpperCase();
  function candidates(row: SummaryRow): SummaryCandidate[] {
    const query = (searches[row.entry.row] || '').trim().toLowerCase();
    const found = query ? owners.filter(owner => canEdit(owner) && [owner.propertyName, owner.ownerName, owner.noTel, owner.location || ''].join(' ').toLowerCase().includes(query)).slice(0, 15).map(owner => ({ ...owner, reason: 'Manual search result', canEdit: true })) : [];
    return [...row.candidates, ...found].filter((candidate, i, all) => all.findIndex(other => other.id === candidate.id) === i);
  }
  function select(row: SummaryRow, id: number | null) {
    const candidate = candidates(row).find(item => item.id === id);
    setManual(previous => ({ ...previous, [row.entry.row]: true }));
    setPreview(previous => previous && ({ ...previous, rows: previous.rows.map(item => item.entry.row === row.entry.row ? { ...item, candidates: candidate && !item.candidates.some(value => value.id === candidate.id) ? [...item.candidates, candidate] : item.candidates, createNew:false, selectedOwnerId: id, selectedVersion: candidate?.version ?? null } : item) }));
  }
  const editedEntries=preview?applySummaryReferenceEdits(preview.rows.map(row=>row.entry),preview.rows.map(row=>({row:row.entry.row,reference:reference(row)}))):[];
  const reviewedRows=preview?.rows.map((row,index)=>({...row,entry:editedEntries[index],issue:row.entry.issues.length&&row.issue===row.entry.issues.join(' ')?editedEntries[index].issues.join(' ')||undefined:row.issue}))||[];
  const selected = reviewedRows.filter(row => row.state !== 'applied' && (row.selectedOwnerId !== null || row.createNew));
  const permitted = (row: SummaryRow) => {
    if(row.createNew)return !!row.canCreate;
    const owner = owners.find(item => item.id === row.selectedOwnerId);
    const candidate = row.candidates.find(item => item.id === row.selectedOwnerId);
    return owner ? canEdit(owner) : !!candidate?.canEdit;
  };
  const ready=selected.filter(row=>{
    const owner=owners.find(item=>item.id===row.selectedOwnerId),candidate=row.candidates.find(item=>item.id===row.selectedOwnerId),type=owner?.transactionType||candidate?.transactionType;
    return !row.entry.issues.length&&permitted(row)&&(!type||type===row.entry.transactionType);
  });
  async function apply(savePendingOnly = false) {
    if (!preview) return;
    setNotice('');
    if(!savePendingOnly&&!ready.length){setError('No ready listings selected. Choose an owner or create a missing owner, and review the pending row issues.');return;}
    setBusy(true); setError('');
    try {
      const next = await commitOwnerSummaryReport(preview.reportId, reviewedRows.filter(row => row.state !== 'applied').map(row => ({ row: row.entry.row, ownerId: row.selectedOwnerId, ...(row.selectedVersion !== null ? { version: row.selectedVersion } : {}), reference: reference(row),createNew:!!row.createNew,defer:!ready.some(item=>item.entry.row===row.entry.row) })), savePendingOnly);
      setPreview(next);
      const applied=next.applied-preview.applied;
      setNotice(savePendingOnly?`Pending choices saved. ${next.pending} rows remain pending.`:applied>0?`Applied ${applied} listing${applied===1?'':'s'}. ${next.pending} rows remain pending for review.`:`No new listings were applied. ${next.pending} rows remain pending; review their matches and issues.`);
      if (next.applied > preview.applied) onImported();
      void loadRecent();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <ModalFrame title="Paste listing report" subtitle="Review owner matches. Missing owners create new records with pending property details." onClose={() => { if (!busy) onClose(); }}>
    <div className="min-w-0 space-y-4">
      <label className="block text-sm font-medium">Listing report<textarea className="ui-input mt-1 min-h-40 w-full" value={report} onChange={event => setReport(event.target.value)} placeholder="Paste the full listing report here" disabled={busy}/></label>
      <button className="ui-button" disabled={busy || !report.trim()} onClick={() => void open()}>Preview report</button>
      {recent.some(item => item.pending > 0) && <div className="space-y-2"><p className="text-sm font-semibold">Saved pending reports</p>{recent.filter(item => item.pending > 0).map(item => <button key={item.id} className="ui-button block max-w-full whitespace-normal text-left" disabled={busy} onClick={() => void open(item.id)}>{new Date(item.createdAt).toLocaleString()} · {item.pending} pending / {item.total} rows</button>)}</div>}
      {nextOffset!==null&&<button className="ui-button" disabled={busy} onClick={()=>void loadRecent(true)}>Load older pending reports</button>}
      {error && !preview && <p role="alert" className="break-words rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {preview && <>
        <p role="status" className="text-sm">{preview.applied} applied · {preview.pending} pending in saved report · {ready.length} ready to apply</p>
        <div className="space-y-3">{reviewedRows.map(row => {
          const choices = candidates(row);
          const ref = reference(row);
          return <article key={row.entry.row} className="min-w-0 space-y-2 rounded-xl border border-slate-200 p-3 text-sm">
            <p className="font-semibold">Row {row.entry.row} · {row.entry.date || 'Date unavailable'} · {row.state === 'applied' ? 'Applied' : row.createNew ? 'New owner — pending details' : row.selectedOwnerId === null ? 'Pending' : manual[row.entry.row] ? 'Manually selected' : 'Automatically confirmed match'}</p>
            <label className="block">Reference<input className="ui-input mt-1 w-full" aria-label={`Reference for row ${row.entry.row}`} value={references[row.entry.row] ?? row.entry.reference} disabled={busy || row.state === 'applied'} onChange={event => setReferences(previous => ({ ...previous, [row.entry.row]: event.target.value }))}/></label>
            <p className="break-words">{row.entry.ownerName} · {row.entry.phone}<br/>{row.entry.property}</p>
            <p className="font-medium">{ref.startsWith('WTL') ? 'WTL → Rental' : ref.startsWith('WTS') ? 'WTS → Subsale Direct Listing' : 'Destination needs a valid reference'}</p>
            {[...row.entry.issues, ...(row.issue ? [row.issue] : [])].map((issue, index) => <p key={index} className="break-words text-amber-800">{issue}</p>)}
            {row.state !== 'applied' && <>
              <label className="block">Search existing owners<input className="ui-input mt-1 w-full" aria-label={`Search existing owners for row ${row.entry.row}`} value={searches[row.entry.row] || ''} disabled={busy} placeholder="Property, owner or phone (first 15 matches)" onChange={event => setSearches(previous => ({ ...previous, [row.entry.row]: event.target.value }))}/></label>
              <label className="block">Confirm owner match<select className="ui-input mt-1 w-full min-w-0 max-w-full" aria-label={`Owner match for row ${row.entry.row}`} disabled={busy || !user} value={row.selectedOwnerId ?? ''} onChange={event => select(row, event.target.value ? Number(event.target.value) : null)}><option value="">Keep pending — no confirmed owner</option>{choices.map(candidate => <option key={candidate.id} value={candidate.id} disabled={!candidate.canEdit}>{candidate.propertyName} · {candidate.ownerName} · {candidate.noTel}{!candidate.canEdit ? ' (no permission)' : ''}</option>)}</select></label>
              {row.canCreate&&<label className="flex items-center gap-2"><input type="checkbox" disabled={busy} checked={!!row.createNew} onChange={event=>{const checked=event.target.checked;setPreview(previous=>previous&&({...previous,rows:previous.rows.map(r=>r.entry.row===row.entry.row?{...r,createNew:checked,selectedOwnerId:null,selectedVersion:null}:r)}));}}/>Create missing owner and category row — details pending</label>}
              {choices.map(candidate => <p key={candidate.id} className="break-words text-xs text-slate-600">{candidate.id === row.selectedOwnerId ? 'Selected' : 'Suggestion'}: {candidate.propertyName} — {candidate.reason}</p>)}
            </>}
          </article>;
        })}</div>
        <div ref={feedback} tabIndex={-1} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {error&&<p role="alert" className="break-words text-sm text-red-800">{error}</p>}
        {notice&&<p role="status" className="break-words text-sm font-medium text-indigo-800">{notice}</p>}
        <p className="text-sm">{ready.length} ready to apply. {selected.length-ready.length} selected rows need review and will stay pending.</p>
        {!ready.length&&preview.pending>0&&<p className="text-sm text-amber-800">Confirm an owner match or choose to create a missing owner. Correct duplicate references and other row issues before applying.</p>}
        <button className="ui-button ui-primary" disabled={busy || !ready.length} onClick={() => void apply()}>{busy ? 'Working…' : 'Apply matched listings'}</button>
        <button className="ui-button" disabled={busy || !user || !preview.rows.some(row => row.state !== 'applied')} onClick={() => void apply(true)}>Save pending changes</button>
        </div>
      </>}
    </div>
  </ModalFrame>;
}
