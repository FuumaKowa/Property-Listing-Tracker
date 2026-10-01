import {PublicationReportExport} from '../PublicationReportExport';
import {DataWarnings} from '../DailyWork';
import type {WarningKey} from '../../utils/dailyWork';
import React, { useEffect, useState } from "react";
import { creatorLabel } from '../../utils/listingPresentation';
import type { PropertyListing } from "../../types";
import type {
  ListingPublication,
  PublicationChannel,
} from "../../publications";
import {
  fetchListingPublications,
  fetchPublicationChannels,
} from "../../services/publications";
import { PublicationLinks } from "../PublicationLinks";
import { ModalFrame } from "./ModalFrame";
import { formatCalendarDate, formatDateTime } from '../../utils/datePresentation';
export function PropertyDetailsModal({
  listing,
  onClose,
  onEditListing,
  onChanged,
  onIgnore,
}: {
  listing: PropertyListing;
  onClose: () => void;
  onEditListing: (listing: PropertyListing) => void;
  onChanged: () => void;
  onIgnore: (row:PropertyListing,key:WarningKey,ignore:boolean)=>Promise<void>;
}) {
  const [links, setLinks] = useState<ListingPublication[]>([]),
    [channels, setChannels] = useState<PublicationChannel[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [dirty, setDirty] = useState(false),
    [importBusy, setImportBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      fetchListingPublications(listing.id),
      fetchPublicationChannels(),
    ])
      .then(([a, c]) => {
        if (active) {
          setLinks(a);
          setChannels(c);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [listing.id, retry]);
  const canClose = () =>
    !importBusy && (!dirty || confirm("Discard the unsaved advertisement changes?"));
  const fields = [
    ["Property category", listing.projectCategory],
    ["Location", listing.location],
    ["Tenure", listing.tenure],
    ["Lister", listing.pm],
    ["PIC", creatorLabel(listing)],
    ["Lister phone", listing.noTel],
    ["Available units", listing.availableUnits],
    ["Status", listing.status === "Sold Out" ? "Sold" : listing.status],
    ["Renewal", listing.renewStatus],
    ["Negotiator", listing.negotiator],
    ["Agent", listing.agent],
    ["Priority", listing.isPriority ? "High priority (shared)" : "Normal"],
  ];
  return (
    <ModalFrame
      title={listing.property}
      subtitle={`${listing.location} · ${listing.projectCategory || "Property"}`}
      onClose={() => {
        if (canClose()) onClose();
      }}
    >
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-semibold">Property overview</h3>
        <button
          className="ui-button"
          onClick={() => {
            if (canClose()) {
              onClose();
              onEditListing(listing);
            }
          }}
        >
          Edit property
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className="mt-1 break-words text-sm font-medium text-slate-700">
              {value || "Not provided"}
            </dd>
          </div>
        ))}
      </dl>
      <section className="my-6 border-y border-slate-100 py-6">
        <h3 className="mb-4 font-semibold">Publication schedule</h3>
        <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4">
          <div>
            <p className="text-xs text-slate-400">PropertyGuru expiry</p>
            <p className="mt-1 text-sm">{formatCalendarDate(listing.date, "Not scheduled")}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">
              PropertyGuru repost · {listing.propertyGuruRepostMode || "Mode not set"}
            </p>
            <p className="mt-1 text-sm">
              {formatCalendarDate(listing.propertyGuruRepostDate, "Not scheduled")}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Schedule tracking only; no automatic posting.
        </p>
      </section>
      {!loading&&!error&&<PublicationReportExport listing={listing} links={links} channels={channels}/>}
      {loading ? (
        <p role="status">Loading published ads…</p>
      ) : error ? (
        <div role="alert" className="text-sm text-rose-700">
          {error}
          <button
            className="ui-button ml-2"
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      ) : (
        <PublicationLinks
          listingId={listing.id}
          propertyName={listing.property}
          links={links}
          channels={channels}
          onDraftChange={setDirty}
          onBusyChange={setImportBusy}
          onChanged={(next) => {
            setLinks(next);
            onChanged();
          }}
        />
      )}
      <DataWarnings listing={listing} count={loading||error?undefined:links.length} onIgnore={onIgnore}/>
      <section className="mt-6 border-t border-slate-100 pt-6">
        <h3 className="mb-3 font-semibold">Additional information</h3>
        <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          {listing.notes || "No additional notes."}
        </p>
        <p className="mt-4 text-xs text-slate-400">
          Updated by {listing.updatedByName || "Team Member"}
          {listing.lastUpdatedAt
            ? ` · ${formatDateTime(listing.lastUpdatedAt)}`
            : ""}
        </p>
      </section>
    </ModalFrame>
  );
}
