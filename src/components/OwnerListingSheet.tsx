import React, { useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { OwnerListing, OwnerListingInput, OWNER_PROPERTY_TYPES, OWNER_STATUSES, OWNER_SHEET, validateOwnerListing } from '../ownerListing';
import { fetchOwnerListings, saveOwnerListing, deleteOwnerListing } from '../services/ownerListings';

const control = 'min-w-0 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50';
const button = 'rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50';
const blank: OwnerListingInput = { ownerName: '', noTel: '', propertyName: '', propertyType: 'landed', propertyPrice: '', status: 'Unlisted' };
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const formatPrice = (price: string) => {
  const [whole, fraction = '00'] = price.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`;
};

export function OwnerListingSheet() {
  const [rows, setRows] = useState<OwnerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('All');
  const [status, setStatus] = useState('All');
  const [editing, setEditing] = useState<OwnerListing | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetchOwnerListings().then(data => { if (active) setRows(data); })
      .catch(error => { if (active) setError(message(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function refresh() {
    setLoading(true);
    setError('');
    try { setRows(await fetchOwnerListings()); }
    catch (error) { setError(message(error)); }
    finally { setLoading(false); }
  }

  async function update(row: OwnerListing, changes: Partial<OwnerListingInput>) {
    setBusy(true);
    setError('');
    try {
      const saved = await saveOwnerListing({ ...row, ...changes }, row.id);
      setRows(prev => prev.map(item => item.id === row.id ? saved : item));
    } catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }

  async function remove(row: OwnerListing) {
    if (!window.confirm(`Delete the owner listing for ${row.propertyName} (${row.ownerName})?`)) return;
    setBusy(true);
    setError('');
    try {
      await deleteOwnerListing(row.id);
      setRows(prev => prev.filter(item => item.id !== row.id));
    } catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }

  const filtered = rows.map((row, index) => ({ row, number: index + 1 })).filter(({ row }) => {
    const search = query.trim().toLocaleLowerCase();
    return [row.ownerName, row.noTel, row.propertyName].some(value => value.toLocaleLowerCase().includes(search))
      && (type === 'All' || row.propertyType === type) && (status === 'All' || row.status === status);
  });

  const typeSelect = (row: OwnerListing) => (
    <select aria-label={`Property type for ${row.propertyName}`} className={control} value={row.propertyType} disabled={busy || loading}
      onChange={event => void update(row, { propertyType: event.target.value as OwnerListingInput['propertyType'] })}>
      {OWNER_PROPERTY_TYPES.map(value => <option key={value} value={value}>{value}</option>)}
    </select>
  );
  const statusSelect = (row: OwnerListing) => (
    <select aria-label={`Status for ${row.propertyName}`} className={`${control} ${row.status === 'Listed' ? 'text-emerald-700' : 'text-slate-600'}`} value={row.status} disabled={busy || loading}
      onChange={event => void update(row, { status: event.target.value as OwnerListingInput['status'] })}>
      {OWNER_STATUSES.map(value => <option key={value}>{value}</option>)}
    </select>
  );
  const actions = (row: OwnerListing) => (
    <div className="flex gap-2">
      <button className={`${button} text-indigo-700`} disabled={busy || loading} onClick={() => setEditing(row)} aria-label={`Edit ${row.propertyName}`}>Edit</button>
      <button className={`${button} text-rose-700`} disabled={busy || loading} onClick={() => void remove(row)} aria-label={`Delete ${row.propertyName}`}>Delete</button>
    </div>
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50" aria-label={OWNER_SHEET}>
      <div className="shrink-0 space-y-3 border-b border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-bold">{OWNER_SHEET}</h1>
          <div className="flex flex-wrap gap-2">
            <button className={`${button} flex items-center gap-2`} onClick={() => void refresh()} disabled={loading || busy}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
            </button>
            <button className={`${button} flex items-center gap-2 text-indigo-700`} onClick={() => setEditing(null)} disabled={loading || busy}>
              <Plus className="h-4 w-4" />Add owner listing
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <input className={`${control} sm:col-span-2 lg:col-span-1`} type="search" aria-label="Search owner listings" placeholder="Search owner, phone, or property" value={query} onChange={event => setQuery(event.target.value)} />
          <select className={control} aria-label="Filter owner property type" value={type} onChange={event => setType(event.target.value)}>
            <option value="All">All property types</option>{OWNER_PROPERTY_TYPES.map(value => <option key={value}>{value}</option>)}
          </select>
          <select className={control} aria-label="Filter owner listing status" value={status} onChange={event => setStatus(event.target.value)}>
            <option value="All">All statuses</option>{OWNER_STATUSES.map(value => <option key={value}>{value}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm text-slate-500">
          <p role="status">{loading ? 'Loading owner listings…' : `${filtered.length} of ${rows.length} owner listings`}</p>
          {(query || type !== 'All' || status !== 'All') && <button className="text-indigo-700 underline" onClick={() => { setQuery(''); setType('All'); setStatus('All'); }}>Reset filters</button>}
        </div>
        {error && <p role="alert" className="break-words rounded bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      </div>

      <div className="min-h-0 min-w-0 flex-1 p-3 md:overflow-auto sm:p-4">
        {!loading && !error && filtered.length === 0 && <p className="rounded border bg-white p-6 text-center text-slate-500">{rows.length ? 'No owner listings match your filters.' : 'No owner listings yet. Add your first owner listing.'}</p>}
        <div className="hidden overflow-x-auto rounded border border-slate-300 bg-white md:block" role="region" aria-label="Owner listings spreadsheet" tabIndex={0}>
          <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
            <thead className="bg-[#434a78] text-white"><tr>
              {['No', 'Owner_name', 'no_tel', 'Property_name', 'property_type', 'Property_price', 'Status', 'Actions'].map(label => <th key={label} scope="col" className="border border-slate-300/40 px-3 py-3">{label}</th>)}
            </tr></thead>
            <tbody>{filtered.map(({ row, number }) => <tr key={row.id} className="even:bg-slate-50">
              <td className="border border-slate-200 px-3 py-2">{number}</td>
              <td className="max-w-64 break-words border border-slate-200 px-3 py-2">{row.ownerName}</td>
              <td className="border border-slate-200 px-3 py-2">{row.noTel}</td>
              <td className="max-w-64 break-words border border-slate-200 px-3 py-2">{row.propertyName}</td>
              <td className="border border-slate-200 px-3 py-2">{typeSelect(row)}</td>
              <td className="whitespace-nowrap border border-slate-200 px-3 py-2 text-right tabular-nums">{formatPrice(row.propertyPrice)}</td>
              <td className="border border-slate-200 px-3 py-2">{statusSelect(row)}</td>
              <td className="border border-slate-200 px-3 py-2">{actions(row)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">{filtered.map(({ row, number }) => <article key={row.id} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">No. {number}</p>
          <h2 className="break-words font-semibold">{row.propertyName}</h2>
          <dl className="grid grid-cols-1 gap-3 text-sm">
            <div><dt className="text-slate-500">Owner name</dt><dd className="break-words">{row.ownerName}</dd></div>
            <div><dt className="text-slate-500">Phone number</dt><dd className="break-words">{row.noTel}</dd></div>
            <div><dt className="text-slate-500">Property price</dt><dd className="break-words tabular-nums">{formatPrice(row.propertyPrice)}</dd></div>
            <div><dt className="text-slate-500">Property type</dt><dd>{typeSelect(row)}</dd></div>
            <div><dt className="text-slate-500">Status</dt><dd>{statusSelect(row)}</dd></div>
          </dl>
          {actions(row)}
        </article>)}</div>
      </div>
      {editing !== undefined && <OwnerForm key={editing?.id ?? 'new'} initial={editing} number={editing ? rows.findIndex(row => row.id === editing.id) + 1 : rows.length + 1}
        onClose={() => setEditing(undefined)} onSave={async input => {
          const saved = await saveOwnerListing(input, editing?.id);
          setRows(prev => editing ? prev.map(row => row.id === saved.id ? saved : row) : [...prev, saved]);
          setError('');
          setEditing(undefined);
        }} />}
    </section>
  );
}

function OwnerForm({ initial, number, onClose, onSave }: { initial: OwnerListing | null; number: number; onClose: () => void; onSave: (input: OwnerListingInput) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<OwnerListingInput>(initial ?? blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError('');
    try { await onSave(validateOwnerListing(form)); }
    catch (error) { setError(message(error)); setSaving(false); }
  }
  return <dialog ref={dialog} aria-labelledby="owner-form-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    className="modal-panel fixed m-auto w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl backdrop:bg-slate-900/60 sm:p-6">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id="owner-form-title" className="font-bold">{initial ? 'Edit owner listing' : 'Add owner listing'}</h2>
      <button type="button" aria-label="Close owner form" disabled={saving} onClick={onClose} className="rounded p-2"><X className="h-5 w-5" /></button>
    </div>
    <form onSubmit={submit}>
      <fieldset disabled={saving} className="min-w-0 space-y-4">
        <p className="text-sm text-slate-500">No. {number}</p>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="min-w-0 space-y-1 text-sm">Owner name<input autoFocus required maxLength={200} className={control} value={form.ownerName} onChange={event => setForm({ ...form, ownerName: event.target.value })} /></label>
          <label className="min-w-0 space-y-1 text-sm">Phone number<input required type="tel" maxLength={50} className={control} value={form.noTel} onChange={event => setForm({ ...form, noTel: event.target.value })} /></label>
          <label className="min-w-0 space-y-1 text-sm sm:col-span-2">Property name<input required maxLength={300} className={control} value={form.propertyName} onChange={event => setForm({ ...form, propertyName: event.target.value })} /></label>
          <label className="min-w-0 space-y-1 text-sm">Property type<select aria-label="Property type" className={control} value={form.propertyType} onChange={event => setForm({ ...form, propertyType: event.target.value as OwnerListingInput['propertyType'] })}>
            {OWNER_PROPERTY_TYPES.map(value => <option key={value}>{value}</option>)}
          </select></label>
          <label className="min-w-0 space-y-1 text-sm">Property price<input required inputMode="decimal" maxLength={19} placeholder="e.g. 500000.00" className={control} value={form.propertyPrice} onChange={event => setForm({ ...form, propertyPrice: event.target.value })} /></label>
          <label className="min-w-0 space-y-1 text-sm">Status<select aria-label="Status" className={control} value={form.status} onChange={event => setForm({ ...form, status: event.target.value as OwnerListingInput['status'] })}>
            {OWNER_STATUSES.map(value => <option key={value}>{value}</option>)}
          </select></label>
        </div>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <button type="button" className={button} onClick={onClose}>Cancel</button>
          <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{saving ? 'Saving…' : 'Save owner listing'}</button>
        </div>
      </fieldset>
    </form>
  </dialog>;
}
