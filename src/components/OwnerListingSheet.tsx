import { useEffect, useState } from "react";
import {
  OwnerListing,
  OWNER_PROPERTY_TYPES,
  OWNER_STATUSES,
  OWNER_SHEET,
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
const button = "ui-button";
export function OwnerListingSheet() {
  const { user } = useAuth(),
    admin = !!user && ["admin", "super_admin"].includes(user.role);
  const [rows, setRows] = useState<OwnerListing[]>([]),
    [settings, setSettings] = useState<OwnerAssignmentSettings>({
      rules: [],
      agents: [],
    });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("All"),
    [type, setType] = useState("All"),
    [agent, setAgent] = useState("All"),
    [alertOnly, setAlertOnly] = useState(false),
    [now, setNow] = useState(Date.now());
  const [editing, setEditing] = useState<OwnerListing | null | undefined>(),
    [detailId, setDetailId] = useState<number | null>(null),
    [showRules, setShowRules] = useState(false);
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
  const saved = (row: OwnerListing) =>
    setRows((prev) =>
      prev.some((r) => r.id === row.id)
        ? prev.map((r) => (r.id === row.id ? row : r))
        : [...prev, row],
    );
  const filtered = rows
    .map((row, i) => ({ row, number: i + 1 }))
    .filter(
      ({ row }) =>
        [
          row.propertyName,
          row.ownerName,
          row.noTel,
          row.location,
          row.assignedAgentName,
        ].some((v) => v?.toLowerCase().includes(query.trim().toLowerCase())) &&
        (status === "All" || row.status === status) &&
        (type === "All" || row.propertyType === type) &&
        (agent === "All" ||
          (agent === "unassigned"
            ? !row.assignedAgentId
            : String(row.assignedAgentId) === agent)) &&
        (!alertOnly || ownerOverdue(row, now)),
    );
  const detail = rows.find((r) => r.id === detailId);
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50"
      aria-label={OWNER_SHEET}
    >
      <div className="shrink-0 space-y-3 border-b border-slate-200 bg-white p-4 sm:px-6">
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
            onClick={() => setAlertOnly((v) => !v)}
          >
            {rows.filter((r) => ownerOverdue(r, now)).length} inactive for 3
            days
          </button>
          <button
            className={button}
            onClick={() => {
              setAgent("unassigned");
              setAlertOnly(false);
            }}
          >
            {rows.filter((r) => !r.assignedAgentId).length} unassigned
          </button>
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
            <option value="All">All agents</option>
            <option value="unassigned">Unassigned</option>
            {settings.agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            className={button}
            onClick={() => {
              setQuery("");
              setStatus("All");
              setType("All");
              setAgent("All");
              setAlertOnly(false);
            }}
          >
            Reset filters
          </button>
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
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
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
                      "border-b border-slate-100 " +
                      (ownerOverdue(r, now)
                        ? "bg-amber-50"
                        : "bg-white hover:bg-slate-50")
                    }
                  >
                    <td className="px-4 py-3 text-slate-400">{number}</td>
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
                      ownerOverdue(r, now)
                        ? "Follow-up overdue"
                        : !r.assignedAgentId
                          ? "Needs assignment"
                          : "—",
                    ].map((v, i) => (
                      <td key={i} className="px-4 py-3">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-3 p-3 md:hidden">
              {filtered.map(({ row: r, number }) => (
                <article
                  key={r.id}
                  className={
                    "rounded-xl border p-4 " +
                    (ownerOverdue(r, now)
                      ? "border-amber-200 bg-amber-50"
                      : "border-slate-200 bg-white")
                  }
                >
                  <p className="text-xs text-slate-400">
                    No. {number} · {r.propertyType} · {r.status}
                  </p>
                  <button
                    className="my-2 text-left font-semibold text-indigo-700 underline"
                    onClick={() => setDetailId(r.id)}
                  >
                    {r.propertyName}
                  </button>
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
                  <p className="mt-2 text-xs text-slate-500">
                    Added {formatDateTime(r.createdAt)}
                    <br />
                    Assigned {formatDateTime(r.assignedAt)}
                  </p>
                  {ownerOverdue(r, now) && (
                    <p className="mt-2 text-sm text-amber-800">
                      No agent activity for 3 days
                    </p>
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
      <p className="border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
        Showing {filtered.length} of {rows.length} owner listings
      </p>
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
