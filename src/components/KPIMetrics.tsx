import React from 'react';
import { PropertyListing } from '../types';
import { TrendingUp, AlertCircle, CheckCircle2, ShieldAlert, Layers } from 'lucide-react';

interface KPIMetricsProps {
  listings: PropertyListing[];
  onFilterChange: (type: 'all' | 'active' | 'expired' | 'renewal_pending' | 'fmr') => void;
  activeFilterTab: string;
}

export const KPIMetrics: React.FC<KPIMetricsProps> = ({
  listings,
  onFilterChange,
  activeFilterTab,
}) => {
  const total = listings.length;
  const activeListings = listings.filter((l) => l.status === 'Active');
  const expiredListings = listings.filter((l) => l.status === 'Expired');
  const renewedListings = listings.filter((l) => l.renewStatus === 'Renewed');
  const unrenewedExpired = listings.filter(
    (l) => l.status === 'Expired' && l.renewStatus === 'Not Renewed'
  );
  const fmrListings = listings.filter((l) =>
    (l.tenure || '').toLowerCase().includes('malay reserved')
  );

  const renewalSuccessRate =
    total > 0 ? ((renewedListings.length / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 bg-white border-b border-slate-200 divide-x divide-slate-100 shrink-0">
      {/* 1. Total Listings */}
      <button
        onClick={() => onFilterChange('all')}
        className={`px-5 py-2.5 text-left transition-colors cursor-pointer hover:bg-slate-50/80 ${
          activeFilterTab === 'all' ? 'bg-indigo-50/40 border-b-2 border-indigo-600' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
            <Layers className="w-3 h-3 text-slate-400" />
            Total Listings
          </p>
          <span className="text-[10px] text-emerald-600 font-medium flex items-center">
            <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
            +12%
          </span>
        </div>
        <p className="text-xl font-bold text-slate-900 mt-0.5">
          {total} <span className="text-[10px] text-slate-400 font-normal ml-1">Projects</span>
        </p>
      </button>

      {/* 2. Active Inventory */}
      <button
        onClick={() => onFilterChange('active')}
        className={`px-5 py-2.5 text-left transition-colors cursor-pointer hover:bg-slate-50/80 ${
          activeFilterTab === 'active' ? 'bg-indigo-50/40 border-b-2 border-indigo-600' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-indigo-500" />
            Active Inventory
          </p>
          <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1 rounded">
            {Math.round((activeListings.length / (total || 1)) * 100)}%
          </span>
        </div>
        <p className="text-xl font-bold text-indigo-600 mt-0.5">
          {activeListings.length}{' '}
          <span className="text-[10px] text-slate-400 font-normal ml-1">Live Units</span>
        </p>
      </button>

      {/* 3. Expired / Renewal Due */}
      <button
        onClick={() => onFilterChange('renewal_pending')}
        className={`px-5 py-2.5 text-left transition-colors cursor-pointer hover:bg-slate-50/80 ${
          activeFilterTab === 'renewal_pending' ? 'bg-rose-50/40 border-b-2 border-rose-600' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-rose-500" />
            Renewal Pending
          </p>
          <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1 rounded animate-pulse">
            Action Req.
          </span>
        </div>
        <p className="text-xl font-bold text-rose-600 mt-0.5">
          {unrenewedExpired.length}{' '}
          <span className="text-[10px] text-rose-400 font-normal ml-1">
            of {expiredListings.length} Expired
          </span>
        </p>
      </button>

      {/* 4. Renewal Success Rate */}
      <div className="px-5 py-2.5 text-left">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
            Renewal Success Rate
          </p>
          <span className="text-[10px] text-emerald-600 font-semibold">
            {renewedListings.length}/{total}
          </span>
        </div>
        <p className="text-xl font-bold text-emerald-600 mt-0.5">
          {renewalSuccessRate}%{' '}
          <span className="text-[10px] text-slate-400 font-normal ml-1">Compliance</span>
        </p>
      </div>

      {/* 5. Freehold Malay Reserved */}
      <button
        onClick={() => onFilterChange('fmr')}
        className={`px-5 py-2.5 text-left transition-colors cursor-pointer hover:bg-slate-50/80 ${
          activeFilterTab === 'fmr' ? 'bg-amber-50/40 border-b-2 border-amber-600' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-amber-600" />
            Malay Reserved
          </p>
          <span className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded font-bold">
            F.M.R.
          </span>
        </div>
        <p className="text-xl font-bold text-amber-800 mt-0.5">
          {fmrListings.length}{' '}
          <span className="text-[10px] text-amber-600/80 font-normal ml-1">Specialized</span>
        </p>
      </button>
    </div>
  );
};
