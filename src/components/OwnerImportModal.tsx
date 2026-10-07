import { useEffect, useRef, useState } from "react";
import { ModalFrame } from "./Modals/ModalFrame";
import {
  OWNER_IMPORT_FIELDS,
  type OwnerImportRaw,
  type OwnerImportRow,
  type OwnerImportChoice,
  type OwnerImportResult,
} from "../ownerImport";
import {
  guessOwnerMapping,
  mapOwnerSheet,
  type OwnerMapping,
} from "../utils/ownerImportMapping";
import type { OwnerImportSheet } from "../utils/ownerImportFile";
import {
  previewOwnerImport,
  commitOwnerImport,
} from "../services/ownerListings";

export function OwnerImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [sheets, setSheets] = useState<OwnerImportSheet[]>([]),
    [sheetIndex, setSheetIndex] = useState(0),
    [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<OwnerMapping>({}),
    [raw, setRaw] = useState<OwnerImportRaw[]>([]);
  const [preview, setPreview] = useState<OwnerImportRow[] | null>(null),
    [choices, setChoices] = useState<OwnerImportChoice[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<OwnerImportResult | null>(null),
    [submitted, setSubmitted] = useState(false);
  const importId = useRef(crypto.randomUUID()),
    worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const sheet = sheets[sheetIndex];
  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    setSheets([]);
    setFileName(file.name);
    setPreview(null);
    setResult(null);
    setSubmitted(false);
    importId.current = crypto.randomUUID();
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Choose a file smaller than 5 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = await new Promise<OwnerImportSheet[]>(
        (resolve, reject) => {
          const w = new Worker(
            new URL("../workers/ownerImport.worker.ts", import.meta.url),
            { type: "module" },
          );
          worker.current = w;
          const timeout = setTimeout(() => {
            w.terminate();
            reject(
              new Error(
                "This file took too long to read. Try a smaller CSV file.",
              ),
            );
          }, 15000);
          const finish = () => {
            clearTimeout(timeout);
            w.terminate();
            worker.current = null;
          };
          w.onmessage = (e) => {
            finish();
            e.data.error
              ? reject(new Error(e.data.error))
              : resolve(e.data.sheets);
          };
          w.onerror = () => {
            finish();
            reject(
              new Error(
                "Unable to read this file. Try saving a copy as CSV UTF-8.",
              ),
            );
          };
          w.postMessage({ bytes, name: file.name }, [bytes.buffer]);
        },
      );
      const first = Math.max(
        0,
        parsed.findIndex((s) => !s.error),
      );
      setSheets(parsed);
      setSheetIndex(first);
      setMapping(guessOwnerMapping(parsed[first].headers));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function review() {
    setBusy(true);
    setError("");
    try {
      const items = mapOwnerSheet(sheet, mapping),
        data = await previewOwnerImport(items);
      setRaw(items);
      setPreview(data.rows);
      setChoices(data.rows.map((r) => (r.kind === "new" ? "new" : "skip")));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    setSubmitted(true);
    try {
      setResult(await commitOwnerImport(raw, choices, importId.current));
      onImported();
    } catch (e) {
      setError(
        (e as Error).message + " You can retry safely with the same choices.",
      );
    } finally {
      setBusy(false);
    }
  }
  const selected = choices.filter((c) => c !== "skip").length;
  const duplicateCount =
    preview?.filter((r) => r.kind === "duplicate").length || 0;
  const ignored =
    sheet?.headers.filter((_, i) => !Object.values(mapping).includes(i)) || [];
  return (
    <ModalFrame
      title="Import owner listings"
      subtitle="Excel or CSV · Master Listing Owner"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      {result ? (
        <div className="space-y-4">
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"
          >
            <h3 className="text-lg font-semibold text-emerald-900">
              Import complete
            </h3>
            <p className="mt-2">
              {result.added} appended · {result.skipped} skipped
            </p>
          </div>
          <p className="text-sm text-slate-600">
            Existing properties and their history are unchanged. New listings
            follow the location assignment rules.
          </p>
          {result.skippedRows.length > 0 && (
            <p className="text-sm text-slate-600">
              Skipped file rows:{" "}
              {result.skippedRows.map((n) => sheet.rows[n - 1].line).join(", ")}
              . This includes rows you skipped and any new matches found while
              saving. To append one anyway, import the file again and review its
              warning.
            </p>
          )}
          <button className="ui-button ui-primary" onClick={onClose}>
            Done
          </button>
        </div>
      ) : preview ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Review before importing</p>
            <p className="mt-1">
              {duplicateCount} possible duplicate
              {duplicateCount === 1 ? "" : "s"} found. Matches default to Skip.
              Choose Append anyway only if you want a separate row; existing
              records will not be updated.
            </p>
            <p className="mt-2 text-xs">
              Matches use the property link or matching property, type, price
              and contact details. Any duplicate found after this preview will
              be skipped unless you chose Append anyway.
            </p>
          </div>
          <p className="text-sm text-slate-600">
            {fileName} · {sheet.name} · {preview.length} rows · {selected}{" "}
            selected
          </p>
          <div className="space-y-3">
            {preview.map((r, i) => (
              <article
                key={r.row}
                className={
                  "rounded-xl border p-4 " +
                  (r.kind === "duplicate"
                    ? "border-amber-300 bg-amber-50/40"
                    : r.kind === "invalid"
                      ? "border-rose-200 bg-rose-50"
                      : "border-slate-200")
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      File row {sheet.rows[i].line} ·{" "}
                      {r.kind === "duplicate"
                        ? "Possible duplicate"
                        : r.kind === "invalid"
                          ? "Needs correction"
                          : "New listing"}
                    </p>
                    <h3 className="mt-1 break-words font-semibold">
                      {r.input?.propertyName ||
                        raw[i].propertyName ||
                        "Unnamed property"}
                    </h3>
                  </div>
                  <select
                    className="ui-input w-auto max-w-full"
                    aria-label={`Action for file row ${sheet.rows[i].line}`}
                    value={choices[i]}
                    disabled={busy || submitted || r.kind === "invalid"}
                    onChange={(e) =>
                      setChoices((v) =>
                        v.map((c, j) =>
                          j === i ? (e.target.value as OwnerImportChoice) : c,
                        ),
                      )
                    }
                  >
                    <option value="skip">Skip</option>
                    {r.kind !== "invalid" && (
                      <option value={r.kind === "duplicate" ? "append" : "new"}>
                        {r.kind === "duplicate"
                          ? "Append anyway"
                          : "Append new row"}
                      </option>
                    )}
                  </select>
                </div>
                {r.input && (
                  <>
                    <p className="mt-2 text-sm text-slate-700">
                      {r.input.propertyType} · RM {r.input.propertyPrice} ·{" "}
                      {r.input.location || "No location — stays unassigned"}
                    </p>
                    <p className="mt-1 break-words text-sm text-slate-600">
                      Owner: {r.input.ownerName} · Phone: {r.input.noTel}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {r.input.status} · Seeding:{" "}
                      {r.input.seedingStatus || "Not started"}
                    </p>
                    {r.input.propertyLink && (
                      <a
                        className="mt-1 block break-all text-sm text-indigo-700 underline"
                        href={r.input.propertyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {r.input.propertyLink}
                      </a>
                    )}
                  </>
                )}
                {r.matches.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-sm text-amber-900">
                    {r.matches.map((m, j) => (
                      <li key={j}>
                        {m.id
                          ? `Existing owner listing #${m.id}`
                          : `Earlier file row ${sheet.rows[m.row! - 1].line}`}
                        : {m.name}
                      </li>
                    ))}
                  </ul>
                )}
                {r.error && (
                  <p className="mt-2 text-sm text-rose-800">
                    {r.error} This row will be skipped. Correct the file to
                    import it.
                  </p>
                )}
              </article>
            ))}
          </div>
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t bg-white py-3">
            <button
              className="ui-button"
              disabled={busy || submitted}
              onClick={() => setPreview(null)}
            >
              Back to columns
            </button>
            <button
              className="ui-button ui-primary"
              disabled={busy || !selected}
              onClick={save}
            >
              {busy
                ? "Importing…"
                : submitted
                  ? "Retry import"
                  : `Append ${selected} row${selected === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            Choose a file, match its columns, then review duplicates before
            anything is added. Up to 200 rows and 5 MB per file.
          </p>
          <label className="block rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5">
            <span className="mb-3 block font-semibold">Excel / CSV file</span>
            <input
              className="block w-full text-sm"
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={busy}
              onChange={(e) => void chooseFile(e.target.files?.[0])}
            />
          </label>
          {busy && (
            <p role="status" className="text-sm text-slate-600">
              Reading and checking your file…
            </p>
          )}
          {sheet && (
            <>
              <label className="block text-sm font-medium">
                Worksheet
                <select
                  className="ui-input mt-1 w-full"
                  value={sheetIndex}
                  disabled={busy}
                  onChange={(e) => {
                    const i = Number(e.target.value);
                    setSheetIndex(i);
                    setMapping(guessOwnerMapping(sheets[i].headers));
                    setError("");
                  }}
                >
                  {sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {sheet.error ? (
                <p role="alert" className="text-sm text-rose-800">
                  {sheet.error}
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-500">
                    {sheet.rows.length} rows found. The first non-empty row
                    supplies the column names.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {OWNER_IMPORT_FIELDS.map(([key, label, required]) => (
                      <label key={key} className="block text-sm font-medium">
                        {label}
                        {required ? " *" : ""}
                        <select
                          className="ui-input mt-1 w-full"
                          disabled={busy}
                          value={mapping[key] ?? -1}
                          onChange={(e) =>
                            setMapping((v) => ({
                              ...v,
                              [key]: Number(e.target.value),
                            }))
                          }
                        >
                          <option value={-1}>
                            {required ? "Choose column" : "Not in file"}
                          </option>
                          {sheet.headers.map((h, i) => (
                            <option key={i} value={i}>
                              {i + 1}. {h}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  {ignored.length > 0 && (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                      <strong>Columns not imported:</strong>{" "}
                      {ignored.join(", ")}.
                    </p>
                  )}
                  <p className="text-sm text-slate-600">
                    Missing owner name or phone becomes “Not captured”; blank
                    status becomes Unlisted. Assignment follows Location, and
                    added/assigned dates start when imported. Source IDs, old
                    dates and assignment history are not imported. Each import
                    creates manual owner records.
                  </p>
                  <button
                    className="ui-button ui-primary"
                    disabled={busy}
                    onClick={review}
                  >
                    {busy ? "Checking…" : "Preview import"}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </ModalFrame>
  );
}
