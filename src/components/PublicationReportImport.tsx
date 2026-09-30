import React, { useState } from 'react';
import { parsePublicationReport, matchReportChannel, type ReportEntry } from '../reportImport';
import type { ListingPublication, PublicationChannel } from '../publications';
import { importListingPublications } from '../services/publications';

type ReviewRow = ReportEntry & {channelId: number; selected: boolean};
export function PublicationReportImport({listingId, propertyName, links, channels, onCancel, onImported, onBusyChange}: {
  listingId: number; propertyName: string; links: ListingPublication[]; channels: PublicationChannel[];
  onCancel: () => void;
  onImported: (links: ListingPublication[], message: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [report, setReport] = useState('');
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const activeChannels = channels.filter(channel => !channel.archivedAt);
  const seen = new Set(links.map(link => {try {return new URL(link.url.trim()).href;} catch {return link.url;}}));
  const reviewed = (rows || []).map(row => {
    const duplicate = !!row.url && seen.has(row.url);
    if (row.selected && row.url && !row.issue && row.channelId) seen.add(row.url);
    return {...row, duplicate};
  });
  const selected = reviewed.filter(row => row.selected && row.url && !row.issue && row.channelId && !row.duplicate);
  function preview() {
    setError('');
    try {
      const parsed = parsePublicationReport(report);
      if (!parsed.length) {setError('No advertisement entries found. Paste platform names with their http or https links.');return;}
      setRows(parsed.map(row => {
        const channelId = matchReportChannel(row, channels) || 0;
        return {...row, channelId, selected: !!channelId && !!row.url && !row.issue};
      }));
    } catch (e) {setError((e as Error).message);}
  }
  function update(index: number, change: Partial<ReviewRow>) {
    setRows(current => current!.map((row, i) => i === index ? {...row, ...change} : row));
  }
  async function save() {
    if (busy || !selected.length) return;
    setBusy(true); onBusyChange(true); setError('');
    try {
      const result = await importListingPublications(listingId, selected.map(row => ({channelId: row.channelId, url: row.url!, label: row.label})));
      const duplicates = reviewed.filter(row => row.duplicate).length + result.skipped;
      onImported(result.links, `${result.added} ${result.added === 1 ? 'link' : 'links'} imported${duplicates ? ` · ${duplicates} duplicates skipped` : ''}.`);
    } catch (e) {setError((e as Error).message);}
    finally {setBusy(false); onBusyChange(false);}
  }
  return <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 sm:p-5">
    <h4 className="font-semibold text-slate-800">Paste publication report</h4>
    <p className="mt-1 text-sm text-slate-600">Import links into <strong>{propertyName}</strong>. Existing links and property details are preserved.</p>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    <fieldset disabled={busy} className="mt-4 min-w-0 space-y-4">
      {!rows ? <>
        <label className="ui-label">Report text
          <textarea autoFocus className="ui-input mt-1 min-h-52" rows={9} maxLength={50000} value={report} onChange={e=>setReport(e.target.value)} placeholder={'1. PropertyGuru\nhttps://www.propertyguru.com.my/…\n\n2. Telegram\nhttps://t.me/…'} />
        </label>
        <p className="text-xs text-slate-500">Paste the whole report. Names, phone numbers and headings are not imported. Nothing is saved until you review and import.</p>
        <div className="flex flex-wrap gap-2"><button type="button" className="ui-button ui-primary" disabled={!report.trim()} onClick={preview}>Preview links</button><button type="button" className="ui-button" onClick={onCancel}>Cancel</button></div>
      </> : <>
        <p className="text-sm text-slate-600">{selected.length} ready to import · {reviewed.filter(row=>row.duplicate).length} duplicates · {reviewed.filter(row=>!row.url || row.issue).length} without a usable URL</p>
        <div className="space-y-3">
          {reviewed.map((row,index) => <div key={index} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
            <label className="flex items-start gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" className="mt-1" aria-label={`Import ${row.label} ${index+1}`} checked={row.selected && !row.duplicate && !row.issue && !!row.url} disabled={!row.url || !!row.issue || row.duplicate || !row.channelId} onChange={e=>update(index,{selected:e.target.checked})}/>
              <span className="break-words">{row.label}</span>
            </label>
            {row.url && <p className="my-2 break-all text-xs text-slate-500">{row.url}</p>}
            {row.duplicate ? <p className="mt-2 text-xs text-slate-500">Already listed or repeated in this report — skipped.</p> : row.issue || !row.url ? <p className="mt-2 text-xs text-amber-800">{row.issue || 'No URL supplied'} — not imported.</p> : <label className="ui-label mt-2">Category for {row.label}
              <select className="ui-input mt-1" value={row.channelId} onChange={e=>update(index,{channelId:Number(e.target.value),selected:!!Number(e.target.value)})}>
                <option value={0}>Select a category to include this link</option>
                {activeChannels.map(channel=><option key={channel.id} value={channel.id}>{channel.name}</option>)}
              </select>
              {!row.channelId && <span className="mt-1 block text-xs font-normal text-amber-800">No confident match. Choose a category, or leave this entry out.</span>}
            </label>}
          </div>)}
        </div>
        <p className="text-xs text-slate-500">Report labels are kept with each link. Manage additional categories from Publication channels.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ui-button ui-primary" disabled={!selected.length} onClick={save}>{busy ? 'Importing…' : `Import ${selected.length} ${selected.length===1?'link':'links'}`}</button>
          <button type="button" className="ui-button" onClick={()=>{setRows(null);setError('');}}>Edit report</button>
          <button type="button" className="ui-button" onClick={onCancel}>Cancel</button>
        </div>
      </>}
    </fieldset>
  </div>;
}
