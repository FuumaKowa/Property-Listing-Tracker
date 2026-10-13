import { useEffect, useState } from "react";
import {
  type OwnerListing,
  OWNER_STATUSES,
  OWNER_SEEDING_STAGES,
  safePropertyLink,
} from "../ownerListing";
import {
  ownerAssignmentSettings,
  saveOwnerActivity,
  assignOwnerListing,
  fetchOwnerHistory,
  deleteOwnerListing,
  type OwnerAssignmentSettings,
  type OwnerEvent,
} from "../services/ownerListings";
import { ModalFrame } from "./Modals/ModalFrame";
import { formatDateTime } from "../utils/datePresentation";
import { OwnerListingDestination } from './OwnerListingDestination';
export const ownerPrice = (price: string) => {
  const [w, f = "00"] = price.split(".");
  return (
    "RM " + w.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + f.padEnd(2, "0")
  );
};
export const ownerOverdue = (row: OwnerListing, now = Date.now()) =>
  row.status === "Unlisted" &&
  row.assignedAgentId != null &&
  !!row.activityDueAt &&
  new Date(row.activityDueAt).getTime() <= now;

export function OwnerAssignmentRules({
  settings,
  onChanged,
  onClose,
}: {
  settings: OwnerAssignmentSettings;
  onChanged: (s: OwnerAssignmentSettings) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <ModalFrame
      title="Location assignment rules"
      subtitle="New owner listings use these rules. Existing assignments stay unchanged."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="mb-4 text-sm text-slate-500">
        Choose the login account for each agent. Missing or conflicting
        locations stay unassigned. Inactivity alerts start after 72 hours.
      </p>
      {settings.rules.map((rule) => (
        <div
          className="mb-4 rounded-xl border border-slate-200 p-4"
          key={rule.key}
        >
          <h3 className="font-semibold">{rule.agentLabel}</h3>
          <p className="my-2 text-sm capitalize text-slate-500">
            {rule.areas.join(" · ")}
          </p>
          <select
            aria-label={`Account for ${rule.agentLabel}`}
            className="ui-input"
            disabled={busy}
            value={rule.userId || ""}
            onChange={async (e) => {
              setBusy(true);
              setError("");
              try {
                onChanged(
                  await ownerAssignmentSettings({
                    key: rule.key,
                    userId: e.target.value ? Number(e.target.value) : null,
                  }),
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <option value="">Not configured</option>
            {settings.agents.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-rose-700">
          {error}
        </p>
      )}
    </ModalFrame>
  );
}

export function OwnerWorkflowCard({
  row,
  admin,
  canEdit,
  agents,
  onClose,
  onSaved,
  onEdit,
  onDeleted,
}: {
  row: OwnerListing;
  admin: boolean;
  canEdit: boolean;
  agents: OwnerAssignmentSettings["agents"];
  onClose: () => void;
  onSaved: (r: OwnerListing) => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [stage, setStage] = useState(row.seedingStatus || ""),
    [status, setStatus] = useState(row.status),
    [transactionType, setTransactionType] = useState(row.transactionType),
    [note, setNote] = useState(""),
    [target, setTarget] = useState(String(row.assignedAgentId || "")),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [history, setHistory] = useState<OwnerEvent[]>([]),
    [historyError, setHistoryError] = useState("");
  useEffect(() => {
    let active = true;
    setStage(row.seedingStatus || "");
    setStatus(row.status);
    setTransactionType(row.transactionType);
    setTarget(String(row.assignedAgentId || ""));
    setHistoryError("");
    fetchOwnerHistory(row.id)
      .then((v) => {
        if (active) setHistory(v);
      })
      .catch((e) => {
        if (active) setHistoryError(e.message);
      });
    return () => {
      active = false;
    };
  }, [row.id, row.version]);
  const dirty =
    !!note || stage !== (row.seedingStatus || "") || status !== row.status || transactionType !== row.transactionType;
  async function run(action: () => Promise<OwnerListing>) {
    setBusy(true);
    setError("");
    try {
      onSaved(await action());
      setNote("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const canLeave = () =>
    !busy && (!dirty || confirm("Discard unsaved follow-up?"));
  const href = safePropertyLink(row.propertyLink);
  return (
    <ModalFrame
      title={row.propertyName}
      subtitle={`${row.location || "Location not provided"} · Master Listing Owner`}
      onClose={() => {
        if (canLeave()) onClose();
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {href ? (
          <a
            className="text-indigo-700 underline"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open original post
          </a>
        ) : (
          <span className="text-slate-400">No original post link</span>
        )}
        {canEdit && (
          <button
            className="ui-button"
            disabled={busy}
            onClick={() => {
              if (canLeave()) onEdit();
            }}
          >
            Edit property
          </button>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        {[
          ["Owner", row.ownerName],
          ["Owner phone", row.noTel],
          ["Price", ownerPrice(row.propertyPrice)],
          [
            "Assigned agent",
            row.assignedAgentId
              ? row.assignedAgentName || "Assigned"
              : "Unassigned",
          ],
          ["Date added", formatDateTime(row.createdAt)],
          ["Date assigned", formatDateTime(row.assignedAt)],
          ["Last agent activity", formatDateTime(row.lastAgentActivityAt)],
          [
            "Activity due",
            row.status === "Unlisted"
              ? formatDateTime(row.activityDueAt)
              : "Closed",
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className="mt-1 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      {ownerOverdue(row) && (
        <p
          role="status"
          className="my-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
        >
          No agent activity for at least 3 days. Admin can reassign this
          listing.
        </p>
      )}
      <section className="my-6 border-t border-slate-200 pt-4">
        <h3 className="font-semibold">Follow-up</h3>
        <p className="mt-1 text-xs text-slate-500">
          The assigned agent's note, seeding or status change resets the 3-day
          timer. Admin actions remain in history.
        </p>
        <fieldset disabled={busy || !canEdit} className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="ui-label">
              Seeding stage
              <select
                className="ui-input"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
              >
                <option value="">Not started</option>
                {OWNER_SEEDING_STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="ui-label">
              Status
              <select
                className="ui-input"
                value={status}
                aria-label="Status"
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                {OWNER_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          {status === 'Listed' && <OwnerListingDestination knownType={row.transactionType} value={transactionType} onChange={setTransactionType} />}
          <label className="ui-label">
            Follow-up note
            <textarea
              className="ui-input"
              rows={3}
              maxLength={4000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Called owner; arranging a viewing"
            />
          </label>
          <button
            className="ui-button ui-primary"
            disabled={status === 'Listed' && !transactionType}
            onClick={() =>
              run(() =>
                saveOwnerActivity(row.id, {
                  version: row.version!,
                  seedingStatus: stage || null,
                  status,
                  ...(status === 'Listed' && transactionType ? {transactionType} : {}),
                  ...(note.trim() ? { note } : {}),
                }),
              )
            }
          >
            Save follow-up
          </button>
        </fieldset>
        {!canEdit && (
          <p className="mt-2 text-xs text-slate-500">
            The assigned agent or Admin can update this listing.
          </p>
        )}
      </section>
      {admin && (
        <section className="my-6 rounded-xl bg-slate-50 p-4">
          <h3 className="font-semibold">Admin assignment</h3>
          <p className="my-2 text-xs text-slate-500">
            Reassignment restarts the timer and preserves earlier follow-ups.
          </p>
          <select
            aria-label="Assign to agent"
            className="ui-input"
            value={target}
            disabled={busy}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="ui-button"
              disabled={busy}
              onClick={() => {
                if (canLeave())
                  void run(() =>
                    assignOwnerListing(
                      row.id,
                      row.version!,
                      target ? Number(target) : null,
                    ),
                  );
              }}
            >
              Assign / reassign
            </button>
            <button
              className="ui-button"
              disabled={busy}
              onClick={() => {
                if (canLeave())
                  void run(() =>
                    assignOwnerListing(row.id, row.version!, "auto"),
                  );
              }}
            >
              Apply location rule
            </button>
          </div>
        </section>
      )}
      {error && (
        <p role="alert" className="mb-4 text-sm text-rose-700">
          {error}
        </p>
      )}
      <section className="border-t border-slate-200 pt-4">
        <h3 className="font-semibold">Assignment & follow-up history</h3>
        {historyError && <p role="alert">{historyError}</p>}
        {history.length === 0 && !historyError && (
          <p className="mt-2 text-sm text-slate-500">
            No history recorded yet.
          </p>
        )}
        {history.map((h) => (
          <article
            key={h.id}
            className="border-b border-slate-200 py-3 text-sm"
          >
            <p className="font-medium capitalize">
              {h.action} · {h.actorName}
            </p>
            <p className="text-xs text-slate-500">
              {formatDateTime(h.createdAt)}
            </p>
            {h.action === "assignment" && (
              <p className="mt-1">
                {h.previousAgent || "Unassigned"} →{" "}
                {h.assignedAgent || "Unassigned"}
              </p>
            )}
            {h.action === "activity" && (
              <p className="mt-1">
                {h.seedingStatus || "Not started"} · {h.status}
              </p>
            )}
            {h.note && <p className="mt-1 whitespace-pre-wrap">{h.note}</p>}
          </article>
        ))}
      </section>
      {admin && (
        <button
          className="ui-button mt-6 text-rose-700"
          disabled={busy}
          onClick={async () => {
            if (!canLeave() || !confirm("Delete this owner listing?")) return;
            setBusy(true);
            try {
              await deleteOwnerListing(row.id, row.version!);
              onDeleted();
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          Delete owner listing
        </button>
      )}
    </ModalFrame>
  );
}
