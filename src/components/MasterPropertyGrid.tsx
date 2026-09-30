import React, { useEffect, useMemo, useRef, useState } from "react";
import { History, Pencil, Trash2, Star } from "lucide-react";
import { PropertyListing, FilterState, PROJECT_CATEGORIES } from "../types";
import { fetchPublicationSummaries } from "../services/publications";
import type { PublicationSummary } from "../publications";
import { creatorLabel, renewalRowClass } from '../utils/listingPresentation';
import { matchesPic, picOptions } from '../utils/listingFilters';
interface Props {
  listings: PropertyListing[];
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onEditListing: (item: PropertyListing) => void;
  onViewListing: (item: PropertyListing) => void;
  onDeleteListing: (id: number) => void;
  onUpdateField?: (
    id: number,
    field: keyof PropertyListing,
    value: string | boolean,
    version?: number,
  ) => void | Promise<void>;
  onBatchUpdate: (ids: number[], updates: Partial<PropertyListing>) => void;
  onBatchDelete: (ids: number[]) => void;
  onOpenAuditLog?: (id: number, property: string) => void;
  sheetCategory?: string;
  publicationVersion?: number;
}
export function MasterPropertyGrid({
  listings,
  filters,
  onFilterChange,
  onViewListing,
  onEditListing,
  onDeleteListing,
  onUpdateField,
  onBatchUpdate,
  onBatchDelete,
  onOpenAuditLog,
  sheetCategory,
  publicationVersion,
}: Props) {
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [pic, setPic] = useState('All');
  const [priorityBusy, setPriorityBusy] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]),
    [summaries, setSummaries] = useState<PublicationSummary[]>([]),
    [summaryError, setSummaryError] = useState(""),
    [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState<{
      id: number;
      field: keyof PropertyListing;
      version?: number;
    } | null>(null),
    [value, setValue] = useState("");
  const [editError, setEditError] = useState('');
  const saving = useRef(false);
  const cancelled = useRef(false);
  const filtered = useMemo(
    () =>
      listings
        .filter(
          (p) =>
            [
              p.property,
              p.location,
              p.pm,
              creatorLabel(p),
              p.negotiator,
              p.agent,
              p.noTel,
              p.projectCategory,
            ]
              .join(" ")
              .toLowerCase()
              .includes(filters.searchQuery.toLowerCase()) &&
            (!filters.projectCategory ||
              filters.projectCategory === "All" ||
              p.projectCategory === filters.projectCategory) &&
            (!priorityOnly || p.isPriority) &&
            (pic === "All" || creatorLabel(p) === pic) &&
            (filters.status === "All" || p.status === filters.status) &&
            (filters.renewStatus === "All" ||
              p.renewStatus === filters.renewStatus) &&
            (filters.tenure === "All" ||
              p.tenure === filters.tenure ||
              (filters.tenure === "FMR" && p.tenure.includes("Malay"))) &&
            matchesPic(p.pm, filters.pm) &&
            (filters.location === "All" || p.location === filters.location),
        )
        .sort(
          (a, b) =>
            String(a[filters.sortBy] ?? "").localeCompare(
              String(b[filters.sortBy] ?? ""),
              undefined,
              { numeric: true },
            ) * (filters.sortOrder === "asc" ? 1 : -1),
        ),
    [listings, filters, priorityOnly, pic],
  );
  const ids = filtered.map((p) => p.id).join(",");
  useEffect(() => {
    let active = true;
    setSummaryError("");
    fetchPublicationSummaries(ids ? ids.split(",").map(Number) : [])
      .then((rows) => {
        if (active) setSummaries(rows);
      })
      .catch(() => {
        if (active) setSummaryError("Publication links could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [ids, publicationVersion, retry]);
  useEffect(() => {
    setSelected((prev) =>
      prev.filter((id) => listings.some((p) => p.id === id)),
    );
  }, [listings]);
  const toggle = (id: number) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const allSelected =
    filtered.length > 0 && filtered.every((p) => selected.includes(p.id));
  const selectAll = () =>
    setSelected((prev) =>
      allSelected
        ? prev.filter((id) => !filtered.some((p) => p.id === id))
        : [...new Set([...prev, ...filtered.map((p) => p.id)])],
    );
  const reset = () => {
    setPriorityOnly(false); setPic("All");
    onFilterChange({
      searchQuery: "",
      projectCategory: "All",
      status: "All",
      renewStatus: "All",
      tenure: "All",
      pm: "All",
      location: "All",
    });
  };
  const sort = (field: keyof PropertyListing) =>
    onFilterChange({
      sortBy: field,
      sortOrder:
        filters.sortBy === field && filters.sortOrder === "asc"
          ? "desc"
          : "asc",
    });
  const save = async () => {
    if (!editing || saving.current || cancelled.current) return;
    saving.current = true;
    setEditError('');
    try { await onUpdateField?.(editing.id, editing.field, value,editing.version); setEditing(null); }
    catch(e) { setEditError((e as Error).message+' Your draft is retained.'); }
    finally { saving.current = false; }
  };
  const cell = (
    p: PropertyListing,
    field: keyof PropertyListing,
    fallback?: string,
  ) => (
    <div
      onDoubleClick={() => {
        if (editing || saving.current) return;
        cancelled.current = false;
        setEditError('');
        setEditing({ id: p.id, field, version:p.version });
        setValue(String(p[field] ?? ""));
      }}
      title="Double-click to edit"
    >
      {editing?.id === p.id && editing.field === field ? (
        <input
          aria-label={`Edit ${field}`}
          autoFocus
          className="ui-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape" && !saving.current) {cancelled.current = true; setEditing(null); setEditError('');}
          }}
        />
      ) : (
        String(p[field] || fallback || "—")
      )}
    </div>
  );
  const adButton = (p: PropertyListing) => {
    const summary = summaries.find((s) => s.listingId === p.id);
    return (
      <button
        className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700"
        title={summary?.channels.join(", ") || "View published ads"}
        onClick={() => onViewListing(p)}
      >
        {summaryError ? "View links" : `${summary?.count || 0} links`} ↗
        {!!summary?.channels.length && <span className="mt-1 block max-w-40 truncate text-[10px] text-slate-500">{summary.channels.join(' · ')}</span>}
      </button>
    );
  };
  const status = (p: PropertyListing) => (
    <select
      aria-label={`Status for ${p.property}`}
      value={p.status}
      onChange={(e) => {Promise.resolve(onUpdateField?.(p.id, "status", e.target.value)).catch((e)=>setEditError(e.message));}}
      className={`rounded-full border-0 px-2 py-1 text-xs ${p.status === "Active" ? "bg-emerald-50 text-emerald-700" : p.status === "Expired" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}
    >
      <option>Active</option>
      <option>Expired</option>
      <option value="Sold Out">Sold</option>
      {p.status === "Pending" && <option>Pending</option>}
    </select>
  );
  const actions = (p: PropertyListing) => (
    <div className="flex gap-1">
      <button
        className="p-2 text-slate-500 hover:text-indigo-700"
        aria-label="Edit listing"
        onClick={() => onEditListing(p)}
      >
        <Pencil size={15} />
      </button>
      <button
        className="p-2 text-slate-500"
        aria-label="View property audit history"
        onClick={() => onOpenAuditLog?.(p.id, p.property)}
      >
        <History size={15} />
      </button>
      <button
        className="p-2 text-slate-500 hover:text-rose-700"
        aria-label="Archive listing"
        onClick={() => onDeleteListing(p.id)}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
  const priorityButton = (p: PropertyListing) => (
    <button type="button" aria-label={p.isPriority ? 'Remove priority for ' + p.property : 'Mark high priority for ' + p.property}
      aria-pressed={!!p.isPriority} disabled={priorityBusy.includes(p.id)} title="Shared team priority"
      className={'rounded p-1 ' + (p.isPriority ? 'text-amber-600' : 'text-slate-400')}
      onClick={async () => {
        setPriorityBusy(ids => [...ids,p.id]);
        try { await onUpdateField?.(p.id,'isPriority',!p.isPriority); }
        catch(e) { setEditError((e as Error).message); }
        finally { setPriorityBusy(ids => ids.filter(id => id !== p.id)); }
      }}><Star size={17} fill={p.isPriority ? 'currentColor' : 'none'}/></button>
  );
  const headers: [string, keyof PropertyListing | null][] = [
    ["No.", "id"],
    ["Property address", "property"],
    ["Property category", "projectCategory"],
    ["Location", "location"],
    ["Lister", "pm"],
    ["PIC", "createdByName"],
    ["Lister phone", "noTel"],
    ["Available units", "availableUnits"],
    ["Status", "status"],
    ["PropertyGuru expiry", "date"],
    ["PG repost / auto repost", "propertyGuruRepostDate"],
    ["Published ads", null],
    ["Renewal", "renewStatus"],
    ["Actions", null],
  ];
  return (
    <div className="min-w-0 flex-1 overflow-y-auto bg-[#f5f6fa] p-3 sm:p-6">
      <div className="mb-5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">
          Listing workspace
        </p>
        <h2 className="text-2xl font-bold tracking-tight">
          {sheetCategory === "All" ? "All properties" : sheetCategory}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Click a property address for details and published ads.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 rounded-t-xl border border-slate-200 bg-white p-4">
        <input
          className="ui-input !w-full sm:!w-72"
          aria-label="Search properties"
          placeholder="Search properties, listers, or PICs..."
          value={filters.searchQuery}
          onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
        />
        <select
          aria-label="Filter status"
          className="ui-button"
          value={filters.status}
          onChange={(e) => onFilterChange({ status: e.target.value })}
        >
          <option value="All">All statuses</option>
          <option>Active</option>
          <option>Expired</option>
          <option value="Sold Out">Sold</option>
          <option>Pending</option>
        </select>
        <select
          aria-label="Filter property category"
          className="ui-button"
          value={filters.projectCategory || "All"}
          onChange={(e) => onFilterChange({ projectCategory: e.target.value })}
        >
          <option value="All">All categories</option>
          {PROJECT_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Filter renewal"
          className="ui-button"
          value={filters.renewStatus}
          onChange={(e) => onFilterChange({ renewStatus: e.target.value })}
        >
          <option value="All">All renewal states</option>
          {[
            "Renewed",
            "Not Renewed",
            "Want to be renew",
            "In Progress",
            "-",
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <label className="ui-button flex items-center gap-2">
          <input type="checkbox" checked={priorityOnly} onChange={e=>setPriorityOnly(e.target.checked)} />
          Priority only ({listings.filter(p=>p.isPriority).length})
        </label>
        <select aria-label="Filter PIC" className="ui-button" value={pic} onChange={e=>setPic(e.target.value)}>
          <option value="All">All PICs</option>
          {[...new Set(listings.map(creatorLabel))].sort().map(name=><option key={name}>{name}</option>)}
        </select>
        {(["pm", "location", "tenure"] as const).map((field) => (
          <select
            key={field}
            aria-label={`Filter ${field === 'pm' ? 'Lister' : field}`}
            className="ui-button"
            value={filters[field]}
            onChange={(e) => onFilterChange({ [field]: e.target.value })}
          >
            <option value="All">
              All{" "}
              {field === "pm"
                ? "listers"
                : field === "tenure"
                  ? "tenures"
                  : "locations"}
            </option>
            {(field === 'pm' ? picOptions(listings.map(p=>p.pm)) : [...new Set(listings.map((p) => p[field]).filter(Boolean))]).map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </select>
        ))}
        <button className="ui-button" onClick={reset}>
          Reset Filters
        </button>
      </div>
      {summaryError && (
        <div role="alert" className="bg-amber-50 p-3 text-xs text-amber-800">
          {summaryError}{" "}
          <button onClick={() => setRetry((n) => n + 1)} className="underline">
            Retry
          </button>
        </div>
      )}
      {editError && <p role="alert" className="bg-rose-50 p-3 text-sm text-rose-700">{editError}</p>}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-indigo-50 p-3 text-xs">
          <strong>{selected.length} selected</strong>
          <button
            className="ui-button"
            onClick={() => onBatchUpdate(selected, { renewStatus: "Renewed" })}
          >
            Mark renewed
          </button>
          <button
            className="ui-button"
            onClick={() =>
              onBatchUpdate(selected, { renewStatus: "Want to be renew" })
            }
          >
            Want to be renew
          </button>
          <button
            className="ui-button"
            onClick={() =>
              onBatchUpdate(selected, {
                status: "Expired",
                renewStatus: "Not Renewed",
              })
            }
          >
            Mark expired
          </button>
          <button
            className="ui-button text-rose-700"
            onClick={() => {
                onBatchDelete(selected);
                setSelected([]);
            }}
          >
            Archive selected
          </button>
          <button className="ui-button" onClick={() => setSelected([])}>
            Deselect
          </button>
        </div>
      )}
      <div
        className="hidden overflow-x-auto rounded-b-xl border border-t-0 border-slate-200 bg-white md:block"
        role="region"
        aria-label="Property listings spreadsheet"
        tabIndex={0}
      >
        <table className="w-full whitespace-nowrap text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-4">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={selectAll}
                />
              </th>
              {headers.map(([label, field]) => (
                <th key={label} className="px-4 py-4">
                  {field ? (
                    <button onClick={() => sort(field)}>
                      {label}
                      {filters.sortBy === field
                        ? filters.sortOrder === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
                    </button>
                  ) : (
                    label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr
                key={p.id}
                className={`border-t border-slate-100 ${renewalRowClass(p.renewStatus)} ${selected.includes(p.id) ? "outline outline-2 -outline-offset-2 outline-indigo-400" : ""}`}
              >
                <td className="p-4">
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.property}`}
                    checked={selected.includes(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                </td>
                <td className="px-4 py-5 text-slate-400">{i + 1} {priorityButton(p)}</td>
                <td className="px-4 py-5">
                  <button
                    className="font-semibold text-indigo-800 hover:underline"
                    onClick={() => onViewListing(p)}
                  >
                    {p.property}
                  </button>
                </td>
                <td className="px-4">
                  <span className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700">
                    {p.projectCategory}
                  </span>
                </td>
                <td className="px-4">{cell(p, "location")}</td>
                <td className="px-4">{cell(p, "pm")}</td>
                <td className="px-4">{creatorLabel(p)}</td>
                <td className="px-4">{cell(p, "noTel")}</td>
                <td className="px-4">{cell(p, "availableUnits")}</td>
                <td className="px-4">{status(p)}</td>
                <td className="px-4">{cell(p, "date")}</td>
                <td className="px-4">
                  <button
                    onClick={() => onEditListing(p)}
                    className="text-left"
                  >
                    {p.propertyGuruRepostDate || "Not scheduled"}
                    <span className="block text-[10px] text-slate-400">
                      {p.propertyGuruRepostMode || "Mode not set"}
                    </span>
                  </button>
                </td>
                <td className="px-4">{adButton(p)}</td>
                <td className="px-4">
                  <select
                    aria-label={`Renewal for ${p.property}`}
                    value={p.renewStatus}
                    onChange={(e) =>
                        Promise.resolve(onUpdateField?.(p.id, "renewStatus", e.target.value)).catch((e)=>setEditError(e.message))
                    }
                    className="rounded border border-slate-200 px-2 py-1"
                  >
                    {[
                      "Renewed",
                      "Not Renewed",
                      "Want to be renew",
                      "In Progress",
                      "-",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2">{actions(p)}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={15} className="p-10 text-center text-slate-500">
                  No listings match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <section className="space-y-3 md:hidden" aria-label="Property listings">
        <div className="flex items-center justify-between py-3 text-xs">
          <label>
            <input
              type="checkbox"
              aria-label="Select all"
              checked={allSelected}
              onChange={selectAll}
            />{" "}
            Select all
          </label>
          <select
            aria-label="Sort listings"
            className="ui-button"
            value={filters.sortBy}
            onChange={(e) =>
              onFilterChange({
                sortBy: e.target.value as keyof PropertyListing,
              })
            }
          >
            {headers
              .filter(([, f]) => f)
              .map(([label, f]) => (
                <option key={f} value={f!}>
                  {label}
                </option>
              ))}
          </select>
          <button
            className="ui-button"
            onClick={() =>
              onFilterChange({
                sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
              })
            }
          >
            {filters.sortOrder === "asc" ? "↑" : "↓"}
          </button>
        </div>
        {filtered.map((p) => (
          <article
            key={p.id}
            className={`rounded-xl border border-slate-200 p-4 ${renewalRowClass(p.renewStatus)}`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                aria-label={`Select ${p.property}`}
                checked={selected.includes(p.id)}
                onChange={() => toggle(p.id)}
              />
              <button
                className="flex-1 text-left font-semibold text-indigo-800"
                onClick={() => onViewListing(p)}
              >
                {p.property}
                <span className="mt-1 block text-xs font-normal text-slate-400">
                  {p.location}
                </span>
              </button>
              {priorityButton(p)}
              {status(p)}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              {p.projectCategory} · {p.availableUnits} units · {p.renewStatus}
              <span className="block mt-1">Lister: {p.pm || "Not provided"} · PIC: {creatorLabel(p)}</span>
            </p>
            <div className="mt-3 flex items-center justify-between">
              {adButton(p)}
              {actions(p)}
            </div>
          </article>
        ))}
        {!filtered.length && (
          <p className="p-6 text-center text-sm text-slate-500">
            No listings match your filters.
          </p>
        )}
      </section>
      <p className="mt-4 text-xs text-slate-400">
        Showing {filtered.length} properties · Double-click table details to
        edit inline
      </p>
    </div>
  );
}
