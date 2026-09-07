import React, { useRef } from 'react';
import {
  Plus,
  Sparkles,
  Wand2,
  Download,
  Upload,
  RotateCcw,
  Building2,
  PanelRightClose,
  PanelRightOpen,
  BarChart2,
  History,
  Database,
  RefreshCw,
} from 'lucide-react';
import { PropertyListing } from '../types';
import { exportToCSV, parseCSVToListings, resetListings } from '../utils/storage';

interface HeaderProps {
  listings: PropertyListing[];
  showKPIMetrics: boolean;
  showAIAssistant: boolean;
  onToggleKPIMetrics: () => void;
  onToggleAIAssistant: () => void;
  onOpenAddModal: () => void;
  onOpenExtractModal: () => void;
  onOpenStandardizeModal: () => void;
  onOpenAuditModal: () => void;
  onRefreshListings: () => Promise<void>;
  isRefreshing: boolean;
  onListingsUpdated: (newListings: PropertyListing[]) => void;
}

export const Header: React.FC<HeaderProps> = ({
  listings,
  showKPIMetrics,
  showAIAssistant,
  onToggleKPIMetrics,
  onToggleAIAssistant,
  onOpenAddModal,
  onOpenExtractModal,
  onOpenStandardizeModal,
  onOpenAuditModal,
  onRefreshListings,
  isRefreshing,
  onListingsUpdated,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportCSV = () => {
    exportToCSV(listings);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const nextId = listings.length > 0 ? Math.max(...listings.map((l) => l.id)) + 1 : 1;
        const imported = parseCSVToListings(text, nextId);
        if (imported.length > 0) {
          const updated = [...listings, ...imported];
          onListingsUpdated(updated);
          alert(`Successfully imported ${imported.length} listings from CSV.`);
        } else {
          alert('Could not parse any valid listing rows from this CSV file.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetData = () => {
    if (window.confirm('Reset all listings to initial 25 default records? Any custom additions will be reverted.')) {
      const initial = resetListings();
      onListingsUpdated(initial);
    }
  };

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-2 bg-white border-b border-slate-200 shadow-2xs z-10 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-[#434a78] rounded flex items-center justify-center shadow-xs">
          <Building2 className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 leading-tight">
              Property Listing Tracker
            </h1>
            <span className="bg-slate-100 text-slate-600 font-mono text-[10px] px-1.5 py-0.2 rounded font-medium border border-slate-200">
              {listings.length} items
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Main Action buttons */}
        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded text-xs font-semibold border border-indigo-200 transition-colors cursor-pointer"
          title="Create a new property listing entry"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Add Row</span>
        </button>

        <button
          onClick={onOpenExtractModal}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          title="Extract listings from WhatsApp messages, emails, or text descriptions using Gemini AI"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Extract</span>
        </button>

        <button
          onClick={onOpenStandardizeModal}
          className="hidden md:flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded text-xs font-medium border border-slate-300 transition-colors cursor-pointer"
          title="Standardize locations and tenure categories across dataset"
        >
          <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
          <span>Standardize</span>
        </button>

        {/* CSV and Data Tools */}
        <div className="flex items-center border-l border-slate-200 pl-2 gap-1">
          <button
            onClick={handleExportCSV}
            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded text-xs transition-colors cursor-pointer"
            title="Export Master Table to CSV"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded text-xs transition-colors cursor-pointer"
            title="Import Listings from CSV"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportCSV}
            accept=".csv"
            className="hidden"
          />

          <button
            onClick={handleResetData}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded text-xs transition-colors cursor-pointer"
            title="Reset to Original 25 Records"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-5 w-[1px] bg-slate-200"></div>

        {/* Audit Trail Button */}
        <button
          onClick={onOpenAuditModal}
          className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded text-xs font-medium border border-slate-300 transition-colors cursor-pointer"
          title="View who updated listings and timestamp audit history"
        >
          <History className="w-3.5 h-3.5 text-indigo-600" />
          <span className="hidden md:inline">Audit Trail</span>
        </button>

        {/* Cloud SQL Connected Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-[11px] font-semibold text-emerald-800" title="Connected to managed Cloud SQL PostgreSQL database with live audit synchronization">
          <Database className="w-3 h-3 text-emerald-600" />
          <span>Cloud SQL</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        <button
          onClick={onRefreshListings}
          disabled={isRefreshing}
          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded text-xs transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-50"
          title="Refresh listings from database"
          aria-label="Refresh listings from database"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>

        <div className="h-5 w-[1px] bg-slate-200"></div>

        {/* View toggles for KPI & AI Assistant */}
        <button
          onClick={onToggleKPIMetrics}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
            showKPIMetrics
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
          title="Toggle Summary Metrics Panel"
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Metrics</span>
        </button>

        <button
          onClick={onToggleAIAssistant}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold border transition-colors cursor-pointer ${
            showAIAssistant
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
          }`}
          title="Toggle AI Assistant Sidebar"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">AI Assistant</span>
          {showAIAssistant ? (
            <PanelRightClose className="w-3.5 h-3.5" />
          ) : (
            <PanelRightOpen className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </header>
  );
};
