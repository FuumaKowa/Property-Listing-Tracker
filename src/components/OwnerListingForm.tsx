import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { OwnerListingDestination } from './OwnerListingDestination';
import {
  OwnerListing,
  OwnerListingInput,
  OWNER_PROPERTY_TYPES,
  OWNER_STATUSES,
  validateOwnerListing,
} from "../ownerListing";
const control = "ui-input",
  button = "ui-button";
const blank: OwnerListingInput = {
  ownerName: "",
  noTel: "",
  propertyName: "",
  propertyLink: "",
  propertyType: "landed",
  propertyPrice: "",
  status: "Unlisted",
  location: "",
};
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Unable to save.";
export function OwnerForm({
  initial,
  number,
  onClose,
  onSave,
}: {
  initial: OwnerListing | null;
  number: number;
  onClose: () => void;
  onSave: (input: OwnerListingInput) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<OwnerListingInput>(initial ?? blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(validateOwnerListing(form));
    } catch (error) {
      setError(message(error));
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="owner-form-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      className="modal-panel fixed m-auto w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl backdrop:bg-slate-900/60 sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="owner-form-title" className="font-bold">
          {initial ? "Edit owner listing" : "Add owner listing"}
        </h2>
        <button
          type="button"
          aria-label="Close owner form"
          disabled={saving}
          onClick={onClose}
          className="rounded p-2"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <form onSubmit={submit}>
        <fieldset disabled={saving} className="min-w-0 space-y-4">
          <p className="text-sm text-slate-500">No. {number}</p>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="min-w-0 space-y-1 text-sm">
              Owner name
              <input
                autoFocus
                required
                maxLength={200}
                className={control}
                value={form.ownerName}
                onChange={(event) =>
                  setForm({ ...form, ownerName: event.target.value })
                }
              />
            </label>
            <label className="min-w-0 space-y-1 text-sm">
              Phone number
              <input
                required
                type="tel"
                maxLength={50}
                className={control}
                value={form.noTel}
                onChange={(event) =>
                  setForm({ ...form, noTel: event.target.value })
                }
              />
            </label>
            <label className="min-w-0 space-y-1 text-sm sm:col-span-2">
              Property name
              <input
                required
                maxLength={300}
                className={control}
                value={form.propertyName}
                onChange={(event) =>
                  setForm({ ...form, propertyName: event.target.value })
                }
              />
            </label>
            <label className="ui-label sm:col-span-2">
              Location
              <input
                maxLength={300}
                className={control}
                placeholder="e.g. Shah Alam, Selangor"
                value={form.location || ""}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </label>
            <label className="min-w-0 space-y-1 text-sm sm:col-span-2">
              Property link (optional)
              <input
                type="url"
                inputMode="url"
                maxLength={2048}
                placeholder="https://example.com/original-post"
                className={control}
                value={form.propertyLink ?? ""}
                onChange={(event) =>
                  setForm({ ...form, propertyLink: event.target.value })
                }
              />
            </label>
            <label className="min-w-0 space-y-1 text-sm">
              Property type
              <select
                aria-label="Property type"
                className={control}
                value={form.propertyType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    propertyType: event.target
                      .value as OwnerListingInput["propertyType"],
                  })
                }
              >
                {OWNER_PROPERTY_TYPES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="min-w-0 space-y-1 text-sm">
              Property price
              <input
                required
                inputMode="decimal"
                maxLength={19}
                placeholder="e.g. 500000.00"
                className={control}
                value={form.propertyPrice}
                onChange={(event) =>
                  setForm({ ...form, propertyPrice: event.target.value })
                }
              />
            </label>
            <label className="min-w-0 space-y-1 text-sm">
              Status
              <select
                aria-label="Status"
                className={control}
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status: event.target.value as OwnerListingInput["status"],
                  })
                }
              >
                {OWNER_STATUSES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          {form.status === 'Listed' && <OwnerListingDestination knownType={initial?.transactionType} value={form.transactionType} onChange={transactionType=>setForm({...form,transactionType})} />}
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            <button type="button" className={button} onClick={onClose}>
              Cancel
            </button>
            <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
              {saving ? "Saving..." : "Save owner listing"}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
