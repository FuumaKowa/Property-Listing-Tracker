import React, { useState } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { PublicationReportImport } from './PublicationReportImport';
import type {
  ListingPublication,
  PublicationChannel,
  PublicationInput,
} from "../publications";
import { validatePublicationInput } from "../publications";
import {
  deleteListingPublication,
  saveListingPublication,
} from "../services/publications";
export function PublicationLinks({
  listingId,
  propertyName,
  links,
  channels,
  onChanged,
  onDraftChange,
  onBusyChange,
}: {
  listingId: number;
  propertyName: string;
  links: ListingPublication[];
  channels: PublicationChannel[];
  onChanged: (links: ListingPublication[]) => void;
  onDraftChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [showImport, setShowImport] = useState(false), [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<(PublicationInput & {version?:number}) | null>(null),
    [editId, setEditId] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const edit = (ad?: ListingPublication) => {
    setDraft(
      ad
        ? { ...ad }
        : {
            channelId: channels.find((c) => !c.archivedAt)?.id || 0,
            url: "",
            label: "",
            notes: "",
          },
    );
    setEditId(ad?.id || null);
    setError("");
    onDraftChange(true);
  };
  const cancel = () => {
    if (busy) return;
    setDraft(null);
    onDraftChange(false);
  };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await saveListingPublication(
        listingId,
        editId,
        {...validatePublicationInput(draft),version:draft?.version},
      );
      onChanged(
        editId
          ? links.map((a) => (a.id === editId ? saved : a))
          : [...links, saved],
      );
      setDraft(null);
      onDraftChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(ad: ListingPublication) {
    if (!confirm("Remove this advertisement link?")) return;
    setBusy(true);
    setError("");
    try {
      await deleteListingPublication(listingId, ad.id, ad.version);
      onChanged(links.filter((a) => a.id !== ad.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">
          Published ads <span className="text-slate-400">({links.length})</span>
        </h3>
        <div className="flex flex-wrap gap-2">
        <button type="button" className="ui-button" disabled={busy || !!draft || showImport} onClick={()=>{setShowImport(true);setNotice('');setError('');onDraftChange(true);}}>Paste report</button>
        <button
          type="button"
          disabled={busy || !!draft || showImport}
          className="ui-button"
          onClick={() => edit()}
        >
          + Add link
        </button>
        </div>
      </div>
      {notice && <p role="status" className="mb-3 text-sm text-emerald-700">{notice}</p>}
      {showImport && <PublicationReportImport listingId={listingId} propertyName={propertyName} links={links} channels={channels} onBusyChange={onBusyChange}
        onCancel={()=>{setShowImport(false);onDraftChange(false);}}
        onImported={(updated,message)=>{onChanged(updated);setNotice(message);setShowImport(false);onDraftChange(false);}} />}
      {error && (
        <p role="alert" className="mb-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {draft && (
        <form
          onSubmit={save}
          className="mb-5 space-y-3 rounded-xl bg-slate-50 p-4"
        >
          <label className="ui-label">
            Publication channel
            <select
              className="ui-input"
              value={draft.channelId}
              onChange={(e) =>
                setDraft({ ...draft, channelId: Number(e.target.value) })
              }
              required
            >
              <option value="0" disabled>
                Select channel
              </option>
              {channels
                .filter(
                  (c) =>
                    !c.archivedAt ||
                    links.find((a) => a.id === editId)?.channelId === c.id,
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.archivedAt ? " (archived)" : ""}
                  </option>
                ))}
            </select>
          </label>
          <label className="ui-label">
            Advertisement URL
            <input
              autoFocus
              type="url"
              required
              maxLength={2048}
              className="ui-input"
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
          </label>
          <label className="ui-label">
            Label
            <input
              className="ui-input"
              maxLength={120}
              value={draft.label || ""}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </label>
          <label className="ui-label">
            Notes
            <textarea
              className="ui-input"
              maxLength={4000}
              value={draft.notes || ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
          <div className="flex gap-2">
            <button disabled={busy} className="ui-button ui-primary">
              {busy ? "Saving…" : "Save link"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="ui-button"
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {!links.length && !draft && (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          No published ads yet. Add a link after publishing this property.
        </p>
      )}
      {channels.map((channel) => {
        const ads = links.filter((a) => a.channelId === channel.id);
        return ads.length ? (
          <div key={channel.id} className="mb-5">
            <h4 className="mb-2 text-xs font-semibold text-slate-500">
              {channel.name} {channel.archivedAt && <span>(archived)</span>}
            </h4>
            {ads.map((ad) => (
              <div
                key={ad.id}
                className="mb-2 flex items-start gap-2 rounded-xl border border-slate-200 p-3"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={ad.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-sm font-medium text-indigo-700"
                  >
                    {ad.label || "View published ad"}{" "}
                    <ExternalLink size={13} className="inline" />
                  </a>
                  <p className="mt-1 break-all text-xs text-slate-400">
                    {ad.url}
                  </p>
                  {ad.notes && (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">
                      {ad.notes}
                    </p>
                  )}
                </div>
                <button
                  disabled={busy || !!draft || showImport}
                  type="button"
                  aria-label="Edit ad link"
                  className="rounded p-2 text-slate-500"
                  onClick={() => edit(ad)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  disabled={busy || !!draft || showImport}
                  type="button"
                  aria-label="Remove ad link"
                  className="rounded p-2 text-slate-500"
                  onClick={() => remove(ad)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : null;
      })}
    </section>
  );
}
