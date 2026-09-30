import React, { useState, useEffect } from 'react';
import { X, History, User, Clock, Calendar, CheckCircle2, Edit3, PlusCircle } from 'lucide-react';
import { ListingAuditEntry } from '../../types';
import { fetchAuditLogs } from '../../services/api';
import { formatDateTime, formatAuditValue } from '../../utils/datePresentation';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId?: number;
  listingProperty?: string;
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  listingId,
  listingProperty,
}) => {
  const [logs, setLogs] = useState<ListingAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,setError]=useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);setError('');
      fetchAuditLogs(listingId)
        .then((data) => {
          setLogs(data);
        })
        .catch(e=>setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [isOpen, listingId]);

  if (!isOpen) return null;

  const parseChanges = (changedFieldsStr?: string) => {
    if (!changedFieldsStr) return null;
    try {
      const obj = JSON.parse(changedFieldsStr);
      if('before' in obj || 'after' in obj){
        const before=obj.before||{},after=obj.after||{};
        const hidden=new Set(['id','version','updated_by_user_id','updated_by_name','updated_by_email','last_updated_at','updated_at','created_at']);
        return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>!hidden.has(key)&&JSON.stringify(before[key])!==JSON.stringify(after[key])).map(key=>key.replaceAll('_',' ')+': '+formatAuditValue(key,before[key])+' → '+formatAuditValue(key,after[key])).join('\n');
      }
      return Object.entries(obj).map(([key,val])=>key+': '+formatAuditValue(key,val)).join(', ');
    } catch {
      return changedFieldsStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="modal-panel bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 shrink-0 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Audit Trail & History
              </h2>
              <p className="text-xs text-slate-500">
                {listingId
                  ? `Detailed audit log for #${listingId} (${listingProperty || 'Listing'})`
                  : 'Recent updates across all property listings'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 sm:p-6 min-h-0 overflow-y-auto flex-1 divide-y divide-slate-100">
          {error ? <p role="alert" className="text-rose-700">{error}</p> : loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Loading audit history from Cloud SQL...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No audit records yet</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                History starts when tracking is enabled. Earlier edits cannot be reconstructed.
              </p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    {log.action === 'create' ? (
                      <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {log.userName || 'Anonymous User'}
                      </span>
                      {log.userEmail && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          ({log.userEmail})
                        </span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                        {log.action}
                      </span>
                    </div>

                    {log.changedFields && (
                      <p className="whitespace-pre-wrap text-xs text-slate-600 mt-1 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200/70 inline-block max-w-md break-all">
                        {parseChanges(log.changedFields)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-1 justify-end">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {formatDateTime(log.timestamp)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Listing #{log.listingId}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 shrink-0 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Synchronized with Cloud SQL PostgreSQL
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
