import React, { useState, useEffect } from 'react';
import { PropertyListing, StandardizationResult } from '../../types';
import { standardizeListings } from '../../services/api';
import { Wand2, X, Check, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';

interface StandardizeModalProps {
  isOpen: boolean;
  listings: PropertyListing[];
  onClose: () => void;
  onApplyStandardization: (updates: { id: number; location: string; tenure: string }[]) => void;
}

export const StandardizeModal: React.FC<StandardizeModalProps> = ({
  isOpen,
  listings,
  onClose,
  onApplyStandardization,
}) => {
  const [results, setResults] = useState<StandardizationResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      runStandardization();
    }
  }, [isOpen]);

  const runStandardization = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await standardizeListings(listings);
      if (res.success && res.results) {
        // Filter only those that actually have changes
        const changed = res.results.filter(
          (r) =>
            r.standardizedLocation !== r.originalLocation ||
            r.standardizedTenure !== r.originalTenure
        );
        setResults(changed.length > 0 ? changed : res.results);
        setSelectedIds(changed.map((c) => c.id));
      }
    } catch (err: any) {
      setError(err?.message || 'Standardization analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleApply = () => {
    const toApply = results
      .filter((r) => selectedIds.includes(r.id))
      .map((r) => ({
        id: r.id,
        location: r.standardizedLocation,
        tenure: r.standardizedTenure,
      }));
    onApplyStandardization(toApply);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Wand2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Location & Tenure Standardization (Feature D)
              </h2>
              <p className="text-xs text-slate-300">
                Audits regional naming inconsistencies and standardizes land tenure classifications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[65vh]">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              <p className="text-xs font-semibold">Gemini scanning dataset for taxonomy improvements...</p>
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg text-xs text-indigo-900 flex items-center justify-between">
                <span>
                  Found <strong>{results.length} records</strong> with suggested location / tenure standardizations.
                </span>
                <button
                  onClick={() => setSelectedIds(results.map((r) => r.id))}
                  className="text-xs font-bold text-indigo-700 hover:underline cursor-pointer"
                >
                  Select All
                </button>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {results.map((item) => {
                  const origListing = listings.find((l) => l.id === item.id);
                  const isSelected = selectedIds.includes(item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleSelect(item.id)}
                      className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                        isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                      />

                      <div className="flex-1 text-xs flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">
                            #{String(item.id).padStart(3, '0')} — {origListing?.property || 'Property'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            PM: {origListing?.pm}
                          </span>
                        </div>

                        {/* Location change */}
                        {item.originalLocation !== item.standardizedLocation && (
                          <div className="flex items-center gap-2 text-slate-700 bg-white p-1.5 rounded border border-slate-200">
                            <span className="text-slate-500 font-medium">{item.originalLocation}</span>
                            <ArrowRight className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {item.standardizedLocation}
                            </span>
                          </div>
                        )}

                        {/* Suggestions badge */}
                        <div className="flex flex-wrap gap-1">
                          {item.suggestedChanges.map((change, cIdx) => (
                            <span
                              key={cIdx}
                              className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
                            >
                              • {change}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={selectedIds.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Apply {selectedIds.length} Corrections</span>
          </button>
        </div>
      </div>
    </div>
  );
};
