import React, { useState } from 'react';
import { ExtractionResult, PropertyListing, PROJECT_CATEGORIES } from '../../types';
import { extractListingsWithAI } from '../../services/api';
import { isDatePassed } from '../../utils/dateUtils';
import { Sparkles, X, Plus, AlertCircle, Wand2, Check, RefreshCw } from 'lucide-react';

interface AIExtractModalProps {
  isOpen: boolean;
  initialText?: string;
  onClose: () => void;
  onAddExtractedListings: (extracted: ExtractionResult[]) => void;
}

const SAMPLE_TEXTS = [
  {
    title: 'WhatsApp Single Project (Prompt Blueprint Example)',
    text: 'Hey team, we just got a new leasehold project in Shah Alam called Service Apartment Linkar 52. Haneah will manage it. There are 495 total units and 256 are still available. Let us list it today, October 26th.',
  },
  {
    title: 'Multi-Project WhatsApp Update',
    text: 'Morning updates: 1) Ss Taman Kenanga in Sabak Bernam, Freehold, PM Benik, 10/62 left, Active listed on 23.10. 2) Astana in Chemor Perak, PM Fahmy Osman, 12/70 units, Expired on 18.8, Not Renewed. 3) Bungalow Amber 1 & 2 in Subang Bestari, Shah Alam, PM Haneah, 5/15 units, Active Renewed.',
  },
  {
    title: 'New Malay Reserved Development',
    text: 'Please add new entry: Ss J4 Residence, Jenderam Lestari located at Jenderam Hilir, Dengkil, Selangor. Land tenure is Freehold Malay Reserved. Assigned PM is Zuraini. 35 out of 100 units available. Status is Active, Date 28.10, Renewal status is Renewed.',
  },
];

export const AIExtractModal: React.FC<AIExtractModalProps> = ({
  isOpen,
  initialText = '',
  onClose,
  onAddExtractedListings,
}) => {
  const [inputText, setInputText] = useState(initialText || SAMPLE_TEXTS[0].text);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExtract = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await extractListingsWithAI(inputText);
      if (response.success && response.data) {
        const validated = response.data.map((item) => {
          if (item.date && item.date.trim() !== '-' && item.date.trim() !== '') {
            const isPassed = isDatePassed(item.date);
            const status: 'Active' | 'Expired' = isPassed ? 'Expired' : 'Active';
            return { ...item, status };
          }
          return item;
        });
        setResults(validated);
      } else {
        setError('Could not extract any listings from the input text.');
      }
    } catch (err: any) {
      setError(err?.message || 'Extraction failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateResult = (index: number, field: keyof ExtractionResult, value: string) => {
    setResults((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === 'date' && value && value.trim() !== '-' && value.trim() !== '') {
        item.status = isDatePassed(value) ? 'Expired' : 'Active';
      }
      updated[index] = item;
      return updated;
    });
  };

  const handleRemoveResult = (index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmAdd = () => {
    if (results.length === 0) return;
    onAddExtractedListings(results);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Intelligent Data Extraction (Text-to-Table)
              </h2>
              <p className="text-xs text-slate-300">
                Extract property name, location, tenure, PM, inventory ratios, and dates from raw text
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
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-5">
          {/* Sample Chips */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Quick Sample Prompts:
            </span>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_TEXTS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputText(sample.text)}
                  className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 px-3 py-1 rounded-full border border-slate-200 transition-colors cursor-pointer"
                >
                  {sample.title}
                </button>
              ))}
            </div>
          </div>

          {/* Input Textarea */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Raw Unstructured Text (WhatsApp, Email, Brochure, Notes):</span>
              <span className="text-[11px] text-slate-400 font-normal">
                Supports single or multi-project bulk entries
              </span>
            </label>
            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste raw description here..."
              className="w-full text-xs font-sans p-3 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>

          {/* Action button */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleExtract}
              disabled={isLoading || !inputText.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Gemini Extracting Schema...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Extract Structured Data with Gemini AI</span>
                </>
              )}
            </button>

            {results.length > 0 && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                ✓ {results.length} listings successfully parsed
              </span>
            )}
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Results Review Table */}
          {results.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col mt-2">
              <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 flex items-center justify-between border-b border-slate-200">
                <span>Review & Verify Extracted Records Before Adding to Table:</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  You can edit values inline
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                      <th className="px-3 py-2">Property Name</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">Tenure</th>
                      <th className="px-3 py-2">PM</th>
                      <th className="px-3 py-2">Units</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Renew</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {results.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.property}
                            onChange={(e) => handleUpdateResult(idx, 'property', e.target.value)}
                            className="border border-slate-300 rounded px-2 py-1 w-full text-xs font-semibold"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={row.projectCategory || 'Project Marketing (PM)'}
                            onChange={(e) => handleUpdateResult(idx, 'projectCategory', e.target.value as any)}
                            className="border border-slate-300 rounded px-1.5 py-1 text-xs bg-white font-medium text-indigo-700"
                          >
                            {PROJECT_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.location}
                            onChange={(e) => handleUpdateResult(idx, 'location', e.target.value)}
                            className="border border-slate-300 rounded px-2 py-1 w-full text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={row.tenure}
                            onChange={(e) => handleUpdateResult(idx, 'tenure', e.target.value)}
                            className="border border-slate-300 rounded px-1.5 py-1 text-xs bg-white"
                          >
                            <option value="Freehold">Freehold</option>
                            <option value="Leasehold">Leasehold</option>
                            <option value="Freehold Malay Reserved">Freehold Malay Reserved</option>
                            <option value="-">-</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.pm}
                            onChange={(e) => handleUpdateResult(idx, 'pm', e.target.value)}
                            className="border border-slate-300 rounded px-2 py-1 w-24 text-xs font-medium text-indigo-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.availableUnits}
                            onChange={(e) => handleUpdateResult(idx, 'availableUnits', e.target.value)}
                            className="border border-slate-300 rounded px-2 py-1 w-20 text-xs font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={row.status}
                            onChange={(e) => handleUpdateResult(idx, 'status', e.target.value as any)}
                            className="border border-slate-300 rounded px-1.5 py-1 text-xs bg-white font-semibold"
                          >
                            <option value="Active">Active</option>
                            <option value="Expired">Expired</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.date}
                            onChange={(e) => handleUpdateResult(idx, 'date', e.target.value)}
                            className="border border-slate-300 rounded px-2 py-1 w-16 text-xs font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={row.renewStatus}
                            onChange={(e) =>
                              handleUpdateResult(idx, 'renewStatus', e.target.value as any)
                            }
                            className="border border-slate-300 rounded px-1.5 py-1 text-xs bg-white font-medium"
                          >
                            <option value="Renewed">Renewed</option>
                            <option value="Want to be renew">Want to be renew</option>
                            <option value="Not Renewed">Not Renewed</option>
                          </select>
                        </td>
                        <td className="p-2 text-right">
                          <button
                            onClick={() => handleRemoveResult(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                            title="Remove row"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
            onClick={handleConfirmAdd}
            disabled={results.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add {results.length} Listing{results.length !== 1 ? 's' : ''} to Master Grid</span>
          </button>
        </div>
      </div>
    </div>
  );
};
