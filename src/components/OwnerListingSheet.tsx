import { useEffect, useMemo, useRef, useState } from "react";
import {
  OwnerListing,
  OWNER_PROPERTY_TYPES,
  OWNER_STATUSES,
  OWNER_SHEET,
  OWNER_SEEDING_STAGES,
} from "../ownerListing";
import {
  fetchOwnerListings,
  saveOwnerListing,
  ownerAssignmentSettings,
  type OwnerAssignmentSettings,
} from "../services/ownerListings";
import { useAuth } from "../context/AuthContext";
import { formatDateTime } from "../utils/datePresentation";
import {
  OwnerWorkflowCard,
  OwnerAssignmentRules,
  ownerOverdue,
  ownerPrice,
} from "./OwnerWorkflow";
import { OwnerForm } from "./OwnerListingForm";
import { OwnerImportModal } from "./OwnerImportModal";
import { OwnerSummaryReportImport } from "./OwnerSummaryReportImport";
import { browseOwners, defaultOwnerFilters, type OwnerFilters } from "../utils/ownerBrowsing";
import { Clock3 } from "lucide-react";
import { ownerRowTone, OWNER_ROW_TONES } from "../utils/ownerRowColors";
function OwnerOverdueBadge(){return <span className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-900" title="No agent activity for 3 days"><Clock3 className="h-3.5 w-3.5" aria-hidden="true"/>Overdue</span>;}
const button = "ui-button";
export function OwnerListingSheet({onListingsChanged}:{onListingsChanged?:()=>void}) {
  const { user } = useAuth(),
    admin = !!user && ["admin", "super_admin"].includes(user.role);
  const [rows, setRows] = useState<OwnerListing[]>([]),
    [settings, setSettings] = useState<OwnerAssignmentSettings>({
      rules: [],
      agents: [],
    });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now());
  const [filters, setFilters] = useState<OwnerFilters>(defaultOwnerFilters);
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(50);
  const scrollArea = useRef<HTMLDivElement>(null);
  const [showFilters,setShowFilters] = useState(false);
  const {query,status,type,agent,alertOnly} = filters;
  const updateFilter = <K extends keyof OwnerFilters>(key:K,value:OwnerFilters[K]) => setFilters(previous=>({...previous,[key]:value}));
  const setQuery=(value:string)=>updateFilter('query',value),setStatus=(value:string)=>updateFilter('status',value),setType=(value:string)=>updateFilter('type',value),setAgent=(value:string)=>updateFilter('agent',value);
  const resetFilters=()=>{setFilters({...defaultOwnerFilters});setPage(1);};
  useEffect(()=>{setPage(1);if(scrollArea.current)scrollArea.current.scrollTop=0;},[filters,pageSize]);
  const [editing, setEditing] = useState<OwnerListing | null | undefined>(),
    [detailId, setDetailId] = useState<number | null>(null),
    [showRules, setShowRules] = useState(false),
    [showImport, setShowImport] = useState(false),
    [showSummaryImport, setShowSummaryImport] = useState(false);
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [r, s] = await Promise.all([
        fetchOwnerListings(),
        ownerAssignmentSettings(),
      ]);
      setRows(r);
      setSettings(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const saved = (row: OwnerListing) => {
    setRows((prev) =>
      prev.some((r) => r.id === row.id)
        ? prev.map((r) => (r.id === row.id ? row : r))
        : [...prev, row],
    );
    onListingsChanged?.();
  };
  const results = useMemo(()=>browseOwners(rows,filters,pageSize,page,now),[rows,filters,pageSize,page,now]);
  const filtered=results.pageRows;
  const myCount=rows.filter(row=>row.assignedAgentId===user?.id).length;
  const overdueCount=rows.filter(row=>ownerOverdue(row,now)).length;
  const unassignedCount=rows.filter(row=>row.assignedAgentId==null).length;
  const locations=Array.from(new Set(settings.rules.flatMap(rule=>rule.areas))).sort();
  const changePage=(next:number)=>{setPage(next);if(scrollArea.current)scrollArea.current.scrollTop=0;if(window.innerWidth<768)window.scrollTo({top:0,behavior:"auto"});};
  const detail = rows.find((r) => r.id === detailId);
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50"
      aria-label={OWNER_SHEET}
    >
      <div className="max-h-[50vh] shrink-0 space-y-3 overflow-y-auto border-b border-slate-200 bg-white p-4 sm:px-6">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">
              Listing workspace
            </p>
            <h2 className="text-xl font-bold">{OWNER_SHEET}</h2>
            <p className="mt-1 text-xs text-slate-500">
              Click a property for follow-ups, assignment and history.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={button} onClick={() => setShowSummaryImport(true)}>
              Paste listing report
            </button>
            <button className={button} onClick={() => setShowImport(true)}>
              Import Excel / CSV
            </button>
            {admin && (
              <button className={button} onClick={() => setShowRules(true)}>
                Assignment rules
              </button>
            )}
            <button className={button} onClick={refresh} disabled={loading}>
              Refresh
            </button>
            <button
              className={button + " ui-primary"}
              onClick={() => setEditing(null)}
            >
              + Add owner listing
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={button + " text-amber-800"}
            aria-pressed={alertOnly}
            onClick={() => setFilters({...defaultOwnerFilters,alertOnly:!alertOnly})}
          >
            {overdueCount} Overdue
          </button>
          <button
            className={button}
            onClick={() => {
              setFilters({...defaultOwnerFilters,agent:"unassigned"});
            }}
          >
            {unassignedCount} Unassigned
          </button>
          <button className={button} aria-pressed={agent===String(user?.id)} onClick={()=>setFilters({...defaultOwnerFilters,agent:String(user?.id)})}>{myCount} My listings</button>
          <span className="text-xs text-slate-500">
            Admin can reassign overdue listings. Listed and rejected records do
            not alert.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="ui-input max-w-sm"
            aria-label="Search owner listings"
            placeholder="Search property, location, owner or agent…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className={button}
            aria-label="Filter owner property type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="All">All property types</option>
            {OWNER_PROPERTY_TYPES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            className={button}
            aria-label="Filter owner status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="All">All statuses</option>
            {OWNER_STATUSES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            className={button}
            aria-label="Filter assigned agent"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
          >
            <option value="All">All agents ({results.facetTotal})</option>
            <option value="unassigned">Unassigned ({results.agentCounts.unassigned || 0})</option>
            {settings.agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({results.agentCounts[String(a.id)] || 0})
              </option>
            ))}
          </select>
          <button
            className={button}
            onClick={() => {
              resetFilters();
            }}
          >
            Reset filters
          </button>
        </div>
        <button className={button} aria-expanded={showFilters} aria-controls="owner-extra-filters" onClick={()=>setShowFilters(value=>!value)}>More filters{[filters.location,filters.stage!=='All',filters.minPrice,filters.maxPrice,filters.dateFrom,filters.dateTo,filters.sort!=='newest'].filter(Boolean).length ? " ("+[filters.location,filters.stage!=='All',filters.minPrice,filters.maxPrice,filters.dateFrom,filters.dateTo,filters.sort!=='newest'].filter(Boolean).length+")" : ""}</button>
        {showFilters && <div id="owner-extra-filters" className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">Location<input className="ui-input mt-1 w-44" aria-label="Filter owner location" placeholder="e.g. Shah Alam" list="owner-locations" value={filters.location} onChange={event=>updateFilter('location',event.target.value)}/></label>
          <datalist id="owner-locations">{locations.map(value=><option key={value} value={value}/>)}</datalist>
          <label className="text-xs text-slate-600">Seeding stage<select className={button+' mt-1 block'} aria-label="Filter seeding stage" value={filters.stage} onChange={event=>updateFilter('stage',event.target.value)}><option value="All">All stages</option><option value="not-started">Not started</option>{OWNER_SEEDING_STAGES.map(value=><option key={value}>{value}</option>)}</select></label>
          <label className="text-xs text-slate-600">Min price (RM)<input className="ui-input mt-1 w-32" aria-label="Minimum owner price" inputMode="decimal" placeholder="e.g. 200000" value={filters.minPrice} onChange={event=>updateFilter('minPrice',event.target.value)}/></label>
          <label className="text-xs text-slate-600">Max price (RM)<input className="ui-input mt-1 w-32" aria-label="Maximum owner price" inputMode="decimal" placeholder="e.g. 500000" value={filters.maxPrice} onChange={event=>updateFilter('maxPrice',event.target.value)}/></label>
          <label className="text-xs text-slate-600">Date added from<input className="ui-input mt-1 w-36" aria-label="Date added from" placeholder="DD/MM/YYYY" value={filters.dateFrom} onChange={event=>updateFilter('dateFrom',event.target.value)}/></label>
          <label className="text-xs text-slate-600">Date added to<input className="ui-input mt-1 w-36" aria-label="Date added to" placeholder="DD/MM/YYYY" value={filters.dateTo} onChange={event=>updateFilter('dateTo',event.target.value)}/></label>
          <label className="text-xs text-slate-600">Sort<select className={button+' mt-1 block'} aria-label="Sort owner listings" value={filters.sort} onChange={event=>updateFilter('sort',event.target.value)}><option value="newest">Newest added</option><option value="oldest">Oldest added</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="inactivity">Longest inactivity</option></select></label>
        </div>}
        {results.errors.length>0 && <p role="alert" className="text-sm text-rose-700">{results.errors.join(' ')}</p>}
        <p role="status" className="text-sm font-semibold text-slate-700">{results.total} matching listings{agent==='All'?'':agent==='unassigned'?' · Unassigned':' · '+(settings.agents.find(value=>String(value.id)===agent)?.name || 'Selected agent')}</p>
        <div aria-label="Owner row colour legend" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-700">
          <span className="mr-1 font-medium">Row colours:</span>
          {OWNER_ROW_TONES.map(tone=><span key={tone.key} className={"rounded-md border border-slate-300 px-2 py-1 "+tone.classes}>{tone.label}</span>)}
          <span className="text-slate-500">Listed / Rejected override seeding stage.</span>
        </div>
        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
        {admin && settings.rules.some((r) => !r.userId) && (
          <p className="text-sm text-amber-800">
            Some location rules need an agent account. Open Assignment rules to
            finish setup.
          </p>
        )}
      </div>
      <div ref={scrollArea} className="min-h-0 min-w-0 flex-1 overflow-auto">
        {loading ? (
          <p role="status" className="p-6">
            Loading owner listings…
          </p>
        ) : (
          <>
            <table className="hidden w-full min-w-[1500px] border-collapse text-left text-sm md:table">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {[
                    "No.",
                    "Property address",
                    "Location",
                    "Listing type",
                    "Owner",
                    "Phone",
                    "Type",
                    "Price",
                    "Assigned agent",
                    "Date assigned",
                    "Date added",
                    "Seeding",
                    "Status",
                    "Alert",
                  ].map((h) => (
                    <th key={h} className="border-b border-slate-200 px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ row: r, number }) => (
                  <tr
                    key={r.id}
                    className={
                      "border-b border-slate-200 hover:brightness-[0.98] " + ownerRowTone(r).classes
                    }
                  >
                    <td className="px-4 py-3 text-slate-600">{number}</td>
                    <td className="max-w-64 px-4 py-3">
                      <button
                        className="text-left font-semibold text-indigo-700 hover:underline"
                        onClick={() => setDetailId(r.id)}
                      >
                        {r.propertyName}
                      </button>
                    </td>
                    {[
                      r.location || "Not provided",
                      r.transactionType === 'rent' ? 'Rental' : r.transactionType === 'sale' ? 'Sale' : 'Not specified',
                      r.ownerName,
                      r.noTel,
                      r.propertyType,
                      ownerPrice(r.propertyPrice),
                      r.assignedAgentId
                        ? r.assignedAgentName || "Assigned"
                        : "Unassigned",
                      formatDateTime(r.assignedAt),
                      formatDateTime(r.createdAt),
                      r.seedingStatus || "Not started",
                      r.status,
                    ].map((v, i) => (
                      <td key={i} className="px-4 py-3">
                        {v}
                      </td>
                    ))}
                    <td className="px-4 py-3">{ownerOverdue(r,now)?<OwnerOverdueBadge/>:r.assignedAgentId==null?'Needs assignment':'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-3 p-3 md:hidden">
              {filtered.map(({ row: r, number }) => (
                <article
                  key={r.id}
                  className={
                    "rounded-xl border border-slate-200 p-4 " + ownerRowTone(r).classes
                  }
                >
                  <p className="text-xs text-slate-600">
                    No. {number} · {r.propertyType} · {r.status}
                  </p>
                  <button
                    className="my-2 text-left font-semibold text-indigo-700 underline"
                    onClick={() => setDetailId(r.id)}
                  >
                    {r.propertyName}
                  </button>
                  <p className="text-sm">
                    Listing type: {r.transactionType === 'rent' ? 'Rental' : r.transactionType === 'sale' ? 'Sale' : 'Not specified'}
                  </p>
                  <p className="text-sm">
                    {r.location || "Location not provided"} ·{" "}
                    {ownerPrice(r.propertyPrice)}
                  </p>
                  <p className="mt-2 text-sm">
                    Agent:{" "}
                    {r.assignedAgentId
                      ? r.assignedAgentName || "Assigned"
                      : "Unassigned"}{" "}
                    · {r.seedingStatus || "Not started"}
                  </p>
                  <p className="mt-2 text-xs text-slate-700">
                    Added {formatDateTime(r.createdAt)}
                    <br />
                    Assigned {formatDateTime(r.assignedAt)}
                  </p>
                  {ownerOverdue(r, now) && (
                    <div className="mt-2"><OwnerOverdueBadge/></div>
                  )}
                </article>
              ))}
            </div>
            {!filtered.length && (
              <p className="p-8 text-center text-slate-500">
                No owner listings match these filters.
              </p>
            )}
          </>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        <p>Showing {results.start}–{results.end} of {results.total} matching listings · {rows.length} total</p>
        <div className="flex flex-wrap items-center gap-2">
          <label>Rows per page <select className={button} aria-label="Owner rows per page" value={pageSize} onChange={event=>setPageSize(Number(event.target.value))}>{[25,50,100].map(value=><option key={value}>{value}</option>)}</select></label>
          <button className={button} disabled={loading||results.page===1} onClick={()=>changePage(1)} aria-label="First owner page">First</button>
          <button className={button} disabled={loading||results.page===1} onClick={()=>changePage(results.page-1)} aria-label="Previous owner page">Previous</button>
          <span>Page {results.page} of {results.pageCount}</span>
          <button className={button} disabled={loading||results.page===results.pageCount} onClick={()=>changePage(results.page+1)} aria-label="Next owner page">Next</button>
          <button className={button} disabled={loading||results.page===results.pageCount} onClick={()=>changePage(results.pageCount)} aria-label="Last owner page">Last</button>
        </div>
      </div>
      {detail && (
        <OwnerWorkflowCard
          key={detail.id}
          row={detail}
          admin={admin}
          canEdit={admin || detail.assignedAgentId === user?.id}
          agents={settings.agents}
          onClose={() => setDetailId(null)}
          onSaved={saved}
          onEdit={() => {
            setDetailId(null);
            setEditing(detail);
          }}
          onDeleted={() => {
            setRows((r) => r.filter((v) => v.id !== detail.id));
            setDetailId(null);
          }}
        />
      )}
      {showImport && (
        <OwnerImportModal
          onClose={() => setShowImport(false)}
          onImported={() => void refresh()}
        />
      )}
      {showSummaryImport && (
        <OwnerSummaryReportImport owners={rows} onClose={() => setShowSummaryImport(false)} onImported={() => { void refresh(); onListingsChanged?.(); }} />
      )}
      {showRules && (
        <OwnerAssignmentRules
          settings={settings}
          onChanged={setSettings}
          onClose={() => setShowRules(false)}
        />
      )}
      {editing !== undefined && (
        <OwnerForm
          initial={editing}
          number={
            editing
              ? rows.findIndex((r) => r.id === editing.id) + 1
              : rows.length + 1
          }
          onClose={() => setEditing(undefined)}
          onSave={async (input) => {
            saved(await saveOwnerListing(input, editing?.id));
            setEditing(undefined);
          }}
        />
      )}
    </section>
  );
}
