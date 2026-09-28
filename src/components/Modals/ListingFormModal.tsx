import React, { useEffect, useState } from "react";
import {
  PropertyListing,
  ProjectCategory,
  PROJECT_CATEGORIES,
} from "../../types";
import { evaluateListingExpiry } from "../../utils/dateUtils";
import { ModalFrame } from "./ModalFrame";
interface Props {
  isOpen: boolean;
  listingToEdit: PropertyListing | null;
  onClose: () => void;
  onSave: (listing: PropertyListing) => void | Promise<void>;
  nextId: number;
  displayNumber?: number;
  defaultProjectCategory?: ProjectCategory;
}
export function ListingFormModal({
  isOpen,
  listingToEdit,
  onClose,
  onSave,
  nextId,
  defaultProjectCategory = "Project Marketing (PM)",
}: Props) {
  const [form, setForm] = useState<PropertyListing | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setForm(
        listingToEdit
          ? { ...listingToEdit }
          : {
              id: nextId,
              property: "",
              projectCategory: defaultProjectCategory,
              location: "",
              tenure: "Freehold",
              pm: "",
              availableUnits: "",
              status: "Active",
              date: "",
              renewStatus: "Not Renewed",
            },
      );
      setDirty(false);
      setError("");
    }
  }, [isOpen, listingToEdit, nextId, defaultProjectCategory]);
  if (!isOpen || !form) return null;
  const change = (key: keyof PropertyListing, value: string) => {
    setForm({ ...form, [key]: value });
    setDirty(true);
  };
  const close = () => {
    if (!busy && (!dirty || confirm("Discard unsaved property changes?")))
      onClose();
  };
  const input = (label: string, key: keyof PropertyListing, type = "text") => (
    <label className="ui-label">
      {label}
      <input
        type={type}
        className="ui-input"
        value={String(form[key] ?? "")}
        onChange={(e) => change(key, e.target.value)}
        required={key === "property" || key === "location"}
      />
    </label>
  );
  return (
    <ModalFrame
      title={listingToEdit ? "Edit property" : "Add property"}
      subtitle="Listing information and publication schedule"
      onClose={close}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave(
              evaluateListingExpiry({
                ...form,
                property: form.property.trim(),
                location: form.location.trim(),
                propertyGuruRepostDate: form.propertyGuruRepostDate || null,
                propertyGuruRepostMode: form.propertyGuruRepostMode || null,
              }),
            );
            setDirty(false);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
        {input("Property name / address", "property")}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="ui-label">
            Property category
            <select
              className="ui-input"
              value={form.projectCategory}
              onChange={(e) => change("projectCategory", e.target.value)}
            >
              {PROJECT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {input("Location", "location")}
          {input("Tenure", "tenure")}
          {input("Available units", "availableUnits")}
          {input("Lister (negotiator)", "negotiator")}
          {input("PIC", "pm")}
          {input("Lister phone", "noTel")}
          {input("Agent (legacy contact)", "agent")}
          <label className="ui-label">
            Status
            <select
              className="ui-input"
              value={form.status}
              onChange={(e) => change("status", e.target.value)}
            >
              <option>Active</option>
              <option>Expired</option>
              <option value="Sold Out">Sold</option>
              {form.status === "Pending" && <option>Pending</option>}
            </select>
          </label>
          <label className="ui-label">
            Renewal
            <select
              className="ui-input"
              value={form.renewStatus}
              onChange={(e) => change("renewStatus", e.target.value)}
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
          </label>
          {input(
            "PropertyGuru expiry (YYYY-MM-DD or existing date format)",
            "date",
          )}
          {input("PropertyGuru repost date", "propertyGuruRepostDate", "date")}
          <label className="ui-label">
            Repost mode
            <select
              className="ui-input"
              value={form.propertyGuruRepostMode || ""}
              onChange={(e) => change("propertyGuruRepostMode", e.target.value)}
            >
              <option value="">Not set</option>
              <option>Manual</option>
              <option>Auto</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-slate-400">
          Repost dates track your schedule; they do not post automatically.
          Expiry dates update Active/Expired status; Sold is preserved.
        </p>
        <label className="ui-label">
          Additional information
          <textarea
            className="ui-input min-h-24"
            value={form.notes || ""}
            onChange={(e) => change("notes", e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="ui-button"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
          <button className="ui-button ui-primary" disabled={busy}>
            {busy ? "Saving…" : "Save property"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
