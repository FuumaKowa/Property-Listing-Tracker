import { useEffect, useState } from 'react';
import type { OwnerListing } from '../ownerListing';
import type { SummaryCandidate, SummaryPreview, SummaryReportListItem, SummaryRow } from '../ownerSummaryReport';
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
    setBusy(true); setError('');
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
  const selected = preview?.rows.filter(row => row.state !== 'applied' && (row.selectedOwnerId !== null || row.createNew)) || [];
  const permitted = (row: SummaryRow) => {
    if(row.createNew)return !!row.canCreate;
    const owner = owners.find(item => item.id === row.selectedOwnerId);
    const candidate = row.candidates.find(item => item.id === row.selectedOwnerId);
    return owner ? canEdit(owner) : !!candidate?.canEdit;
  };
  async function apply(savePendingOnly = false) {
    if (!preview) return;
    const refs = preview.rows.map(reference);
    for (const row of savePendingOnly ? [] : selected) {
      const ref = reference(row);
      if (!/^WT[LS]-\d{6}-\d{5}$/i.test(ref)) { setError(`Row ${row.entry.row}: enter a reference such as WTL-202610-00018 or WTS-202610-00018.`); return; }
      if (refs.filter(value => value.replace(/[\s/-]/g, '') === ref.replace(/[\s/-]/g, '')).length > 1) { setError(`Resolve duplicate reference ${ref} before applying.`); return; }
      const category = ref.startsWith('WTL') ? 'rent' : 'sale';
      const owner = owners.find(item => item.id === row.selectedOwnerId);
      const candidate = row.candidates.find(item => item.id === row.selectedOwnerId);
      if (!permitted(row)) { setError(`Row ${row.entry.row}: you do not have permission to update this owner.`); return; }
      if ((owner?.transactionType || candidate?.transactionType) && category !== (owner?.transactionType || candidate?.transactionType)) { setError(`Row ${row.entry.row}: category conflict. Choose an owner in the matching category.`); return; }
    }
    setBusy(true); setError('');
    try {
      const next = await commitOwnerSummaryReport(preview.reportId, preview.rows.filter(row => row.state !== 'applied').map(row => ({ row: row.entry.row, ownerId: row.selectedOwnerId, ...(row.selectedVersion !== null ? { version: row.selectedVersion } : {}), reference: reference(row),createNew:!!row.createNew })), savePendingOnly);
      setPreview(next);
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
      {error && <p role="alert" className="break-words rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {preview && <>
        <p role="status" className="text-sm">{preview.applied} applied · {preview.pending} pending in saved report · {selected.length} selected to apply</p>
        <div className="space-y-3">{preview.rows.map(row => {
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
        <button className="ui-button ui-primary" disabled={busy || !selected.length || selected.some(row => !permitted(row))} onClick={() => void apply()}>{busy ? 'Working…' : 'Apply matched listings'}</button>
        <button className="ui-button" disabled={busy || !user || !preview.rows.some(row => row.state !== 'applied')} onClick={() => void apply(true)}>Save pending changes</button>
      </>}
    </div>
  </ModalFrame>;
}
