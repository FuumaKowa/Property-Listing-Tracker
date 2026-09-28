import React, { useEffect, useState } from "react";
import type { PublicationChannel } from "../../publications";
import {
  fetchPublicationChannels,
  savePublicationChannel,
} from "../../services/publications";
import { ModalFrame } from "./ModalFrame";
export function PublicationChannelsModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [channels, setChannels] = useState<PublicationChannel[]>([]),
    [names, setNames] = useState<Record<number, string>>({}),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPublicationChannels()
      .then((rows) => {
        if (active) {
          setChannels(rows);
          setNames(prev => Object.fromEntries(rows.map(c=>[c.id,prev[c.id] ?? c.name])));
          setError("");
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
  }, [retry]);
  async function save(
    id: number | null,
    input: { name?: string; archived?: boolean },
  ) {
    setBusy(true);
    setError("");
    try {
      const row = await savePublicationChannel(id, input);
      setChannels((prev) =>
        id ? prev.map((c) => (c.id === id ? row : c)) : [...prev, row],
      );
      setNames((prev) => ({ ...prev, [row.id]: input.name !== undefined ? row.name : prev[row.id] ?? row.name }));
      if (!id) setName("");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const dirty = !!name || channels.some((c) => names[c.id] !== c.name);
  return (
    <ModalFrame
      title="Publication channels"
      subtitle="Shared across all normal listing sheets"
      onClose={() => {
        if (!busy && (!dirty || confirm("Discard unsaved channel names?")))
          onClose();
      }}
    >
      <p className="mb-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
        Rename a channel across every sheet. Archive it to hide it from new
        selections while preserving existing links.
      </p>
      {error && (
        <p role="alert" className="mb-4 text-sm text-rose-700">
          {error}{" "}
          {!channels.length && <button className="ui-button" onClick={() => setRetry((n) => n + 1)}>
            Retry
          </button>}
        </p>
      )}
      {loading ? (
        <p>Loading channels…</p>
      ) : (
        <>
          <div className="space-y-3">
            {channels.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2">
                <input
                  aria-label={`Channel name ${c.name}`}
                  maxLength={80}
                  className="ui-input min-w-0 flex-1"
                  value={names[c.id] ?? c.name}
                  onChange={(e) =>
                    setNames({ ...names, [c.id]: e.target.value })
                  }
                />
                <button
                  className="ui-button"
                  disabled={busy || names[c.id] === c.name}
                  onClick={() => save(c.id, { name: names[c.id] })}
                >
                  Save name
                </button>
                <button
                  className="ui-button"
                  disabled={busy}
                  onClick={() => save(c.id, { archived: !c.archivedAt })}
                >
                  {c.archivedAt ? "Restore" : "Archive"}
                </button>
              </div>
            ))}
          </div>
          <form
            className="mt-6 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save(null, { name });
            }}
          >
            <input
              required
              maxLength={80}
              aria-label="New channel name"
              className="ui-input min-w-0 flex-1"
              placeholder="New channel name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button disabled={busy} className="ui-button ui-primary">
              + Add channel
            </button>
          </form>
        </>
      )}
      <p className="mt-6 text-xs text-slate-400">
        Master Listing Owner remains unchanged.
      </p>
    </ModalFrame>
  );
}
