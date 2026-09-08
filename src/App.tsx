import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { PropertyListing, FilterState, RenewStatus, ProjectCategory, PROJECT_CATEGORIES } from './types';
import { saveListings } from './utils/storage';
import { autoExpireListings, evaluateListingExpiry, isDatePassed } from './utils/dateUtils';
import { Header } from './components/Header';
import { KPIMetrics } from './components/KPIMetrics';
import { MasterPropertyGrid } from './components/MasterPropertyGrid';
import { ListingFormModal } from './components/Modals/ListingFormModal';
import { AuditTrailModal } from './components/Modals/AuditTrailModal';
import { UserManagementModal } from './components/UserManagementModal';
import { useAuth } from './context/AuthContext';
import {
  fetchListingsFromCloudSql,
  createListingInCloudSql,
  updateListingInCloudSql,
  deleteListingFromCloudSql,
} from './services/api';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">Loading sign in...</div>;
  }
  return user ? <Workspace /> : <LoginScreen />;
}

function Workspace() {
  const { user } = useAuth();
  const userName = user?.displayName || user?.username || 'Team Member';
  const token = null;
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ProjectCategory | 'All'>('Project Marketing (PM)');
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    projectCategory: 'All',
    category: 'All',
    status: 'All',
    renewStatus: 'All',
    tenure: 'All',
    pm: 'All',
    location: 'All',
    sortBy: 'id',
    sortOrder: 'asc',
  });
  const [activeFilterTab, setActiveFilterTab] = useState<string>('all');
  const [showKPIMetrics, setShowKPIMetrics] = useState<boolean>(false);

  // Modal States
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<PropertyListing | null>(null);

  // Audit trail modal state
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [auditListingTarget, setAuditListingTarget] = useState<{ id?: number; property?: string }>({});

  const persistExpiryChanges = useCallback(async (before: PropertyListing[], after: PropertyListing[]) => {
    await Promise.all(
      after
        .filter((listing) => {
          const previous = before.find((item) => item.id === listing.id);
          return previous && (previous.status !== listing.status || previous.renewStatus !== listing.renewStatus);
        })
        .map((listing) => updateListingInCloudSql(listing.id, {
          status: listing.status,
          renewStatus: listing.renewStatus,
          updatedByName: userName,
        }, token, userName, undefined).catch((error) => console.warn('Expiry sync warning:', error)))
    );
  }, [token, userName]);

  const refreshListings = useCallback(async () => {
    setIsDbLoaded(false);
    setIsRefreshing(true);
    try {
      const dbListings = await fetchListingsFromCloudSql();
      const { updatedListings } = autoExpireListings(dbListings || []);
      await persistExpiryChanges(dbListings || [], updatedListings);
      setListings(updatedListings);
      saveListings(updatedListings);
    } catch (err) {
      console.warn('Could not load listings from Cloud SQL:', err);
    } finally {
      setIsDbLoaded(true);
      setIsRefreshing(false);
    }
  }, [persistExpiryChanges]);

  // Initial load from Cloud SQL
  useEffect(() => {
    void refreshListings();
  }, [refreshListings]);

  // Periodic automatic date check: ensures status is synchronized with listing date (Active if not passed, Expired if passed)
  useEffect(() => {
    const checkDateSync = () => {
      setListings((prev) => {
        const { updatedListings, changedCount } = autoExpireListings(prev);
        if (changedCount > 0) {
          void persistExpiryChanges(prev, updatedListings);
          return updatedListings;
        }
        return prev;
      });
    };

    checkDateSync();
    const interval = setInterval(checkDateSync, 15000);
    return () => clearInterval(interval);
  }, [persistExpiryChanges]);

  // Sync to local storage on changes
  useEffect(() => {
    saveListings(listings);
  }, [listings]);

  // Handler for KPI Card tab switches
  const handleKPITabChange = (type: 'all' | 'active' | 'expired' | 'renewal_pending' | 'fmr') => {
    setActiveFilterTab(type);
    if (type === 'all') {
      setFilters((prev) => ({ ...prev, status: 'All', renewStatus: 'All', tenure: 'All' }));
    } else if (type === 'active') {
      setFilters((prev) => ({ ...prev, status: 'Active', renewStatus: 'All', tenure: 'All' }));
    } else if (type === 'expired') {
      setFilters((prev) => ({ ...prev, status: 'Expired', renewStatus: 'All', tenure: 'All' }));
    } else if (type === 'renewal_pending') {
      setFilters((prev) => ({ ...prev, status: 'Expired', renewStatus: 'Not Renewed', tenure: 'All' }));
    } else if (type === 'fmr') {
      setFilters((prev) => ({ ...prev, status: 'All', renewStatus: 'All', tenure: 'FMR' }));
    }
  };

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setActiveFilterTab('custom');
  };

  const sheetListings = useMemo(() => {
    if (activeSheet === 'All') return listings;
    return listings.filter((listing) => (listing.projectCategory || 'Project Marketing (PM)') === activeSheet);
  }, [activeSheet, listings]);

  const handleSheetChange = (sheet: ProjectCategory | 'All') => {
    setActiveSheet(sheet);
    setFilters((prev) => ({ ...prev, projectCategory: 'All', category: 'All' }));
    setActiveFilterTab('all');
  };

  // Add or Edit save with automatic date expiration enforcement and Cloud SQL persistence
  const handleSaveListing = async (listing: PropertyListing) => {
    const checked = evaluateListingExpiry({
      ...listing,
      updatedByName: userName || 'Team Member',
      updatedByEmail: undefined,
      lastUpdatedAt: new Date().toISOString(),
    });

    // Optimistic UI update
    setListings((prev) => {
      const existsIndex = prev.findIndex((l) => l.id === checked.id);
      if (existsIndex >= 0) {
        const updated = [...prev];
        updated[existsIndex] = checked;
        return updated;
      }
      return [...prev, checked];
    });

    // Cloud SQL DB update with user attribution
    try {
      const exists = listings.some((l) => l.id === checked.id);
      if (exists) {
        await updateListingInCloudSql(checked.id, checked, token, userName, undefined);
      } else {
        const { id, ...createData } = checked;
        const saved = await createListingInCloudSql(createData, token, userName, undefined);
        // Replace with DB-generated ID if created
        if (saved && saved.id) {
          setListings((prev) => prev.map((l) => (l.id === checked.id ? saved : l)));
        }
      }
    } catch (err) {
      console.warn('Cloud SQL listing save warning:', err);
    }
  };

  const handleDeleteListing = async (id: number) => {
    if (window.confirm(`Are you sure you want to delete listing #${id}?`)) {
      setListings((prev) => prev.filter((l) => l.id !== id));
      try {
        await deleteListingFromCloudSql(id, token, userName);
      } catch (err) {
        console.warn('Cloud SQL delete warning:', err);
      }
    }
  };

  const handleToggleRenewStatus = async (id: number) => {
    const current = listings.find((l) => l.id === id);
    if (!current) return;

    let nextRenew: RenewStatus = 'Renewed';
    if (current.renewStatus === 'Renewed') {
      nextRenew = 'Want to be renew';
    } else if (current.renewStatus === 'Want to be renew') {
      nextRenew = 'Not Renewed';
    } else {
      nextRenew = 'Renewed';
    }

    const datePassed = isDatePassed(current.date);
    const nextStatus = datePassed ? 'Expired' : nextRenew === 'Renewed' ? 'Active' : current.status;
    const nowIso = new Date().toISOString();

    setListings((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              renewStatus: nextRenew,
              status: nextStatus,
              updatedByName: userName || 'Team Member',
              updatedByEmail: undefined,
              lastUpdatedAt: nowIso,
            }
          : l
      )
    );

    try {
      await updateListingInCloudSql(
        id,
        {
          renewStatus: nextRenew,
          status: nextStatus,
          updatedByName: userName || 'Team Member',
          updatedByEmail: undefined,
          lastUpdatedAt: nowIso,
        },
        token,
        userName,
        undefined
      );
    } catch (err) {
      console.warn('Cloud SQL update renewal warning:', err);
    }
  };

  const handleToggleStatus = async (id: number) => {
    const current = listings.find((l) => l.id === id);
    if (!current) return;
    const nextStatus = current.status === 'Active' ? 'Expired' : 'Active';
    const nowIso = new Date().toISOString();

    setListings((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              status: nextStatus,
              updatedByName: userName || 'Team Member',
              updatedByEmail: undefined,
              lastUpdatedAt: nowIso,
            }
          : l
      )
    );

    try {
      await updateListingInCloudSql(
        id,
        {
          status: nextStatus,
          updatedByName: userName || 'Team Member',
          updatedByEmail: undefined,
          lastUpdatedAt: nowIso,
        },
        token,
        userName,
        undefined
      );
    } catch (err) {
      console.warn('Cloud SQL toggle status warning:', err);
    }
  };

  const handleUpdateField = async (id: number, field: keyof PropertyListing, value: string) => {
    const current = listings.find((l) => l.id === id);
    if (!current) return;

    const updated: PropertyListing = {
      ...current,
      [field]: value,
      updatedByName: userName || 'Team Member',
      updatedByEmail: undefined,
      lastUpdatedAt: new Date().toISOString(),
    };

    if (field === 'date') {
      if (value && value.trim() !== '-' && value.trim() !== '' && value.trim() !== 'N/A') {
        updated.status = isDatePassed(value) ? 'Expired' : 'Active';
      }
    }

    setListings((prev) => prev.map((l) => (l.id === id ? updated : l)));

    try {
      await updateListingInCloudSql(
        id,
        {
          [field]: value,
          status: updated.status,
          updatedByName: userName || 'Team Member',
          updatedByEmail: undefined,
          lastUpdatedAt: updated.lastUpdatedAt,
        },
        token,
        userName,
        undefined
      );
    } catch (err) {
      console.warn('Cloud SQL update field warning:', err);
    }
  };

  // Batch operations
  const handleBatchUpdate = (ids: number[], updates: Partial<PropertyListing>) => {
    setListings((prev) => {
      const mapped = prev.map((l) => (ids.includes(l.id) ? { ...l, ...updates } : l));
      const { updatedListings } = autoExpireListings(mapped);
      return updatedListings;
    });
  };

  const handleBatchDelete = (ids: number[]) => {
    setListings((prev) => prev.filter((l) => !ids.includes(l.id)));
  };


  const nextAvailableId = listings.length > 0 ? Math.max(...listings.map((l) => l.id)) + 1 : 1;
  const nextDisplayNumber = sheetListings.length + 1;

  return (
    <div className="flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-slate-100 font-sans text-slate-900">
      {/* 1. Header Toolbar */}
      <Header
        listings={sheetListings}
        showKPIMetrics={showKPIMetrics}
        onToggleKPIMetrics={() => setShowKPIMetrics((prev) => !prev)}
        onOpenAddModal={() => {
          setEditingListing(null);
          setIsAddEditOpen(true);
        }}
        onOpenAuditModal={() => {
          setAuditListingTarget({});
          setIsAuditModalOpen(true);
        }}
        onRefreshListings={refreshListings}
        isRefreshing={isRefreshing}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
        onListingsUpdated={(newListings) => setListings(newListings)}
      />

      <nav className="flex shrink-0 items-end gap-1 overflow-x-auto border-b border-slate-300 bg-slate-200 px-4 pt-2" aria-label="Listing sheets">
        <button
          onClick={() => handleSheetChange('All')}
          className={`whitespace-nowrap rounded-t-md border border-b-0 px-4 py-2 text-xs font-semibold transition-colors ${
            activeSheet === 'All'
              ? 'border-slate-300 bg-white text-indigo-700'
              : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          All Listings
        </button>
        {PROJECT_CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => handleSheetChange(category)}
            className={`whitespace-nowrap rounded-t-md border border-b-0 px-4 py-2 text-xs font-semibold transition-colors ${
              activeSheet === category
                ? 'border-slate-300 bg-white text-indigo-700'
                : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {category}
          </button>
        ))}
      </nav>

      {/* 2. Optional Top KPI Metric Highlights */}
      {showKPIMetrics && (
        <KPIMetrics
          listings={sheetListings}
          onFilterChange={handleKPITabChange}
          activeFilterTab={activeFilterTab}
        />
      )}

      {/* 3. Main Workspace: Master Spreadsheet Grid & Optional AI Studio Assistant Sidebar */}
      <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* Master Spreadsheet Table Area */}
        <MasterPropertyGrid
          listings={sheetListings}
          filters={filters}
          onFilterChange={handleFilterChange}
          onEditListing={(item) => {
            setEditingListing(item);
            setIsAddEditOpen(true);
          }}
          onDeleteListing={handleDeleteListing}
          onToggleRenewStatus={handleToggleRenewStatus}
          onToggleStatus={handleToggleStatus}
          onUpdateField={handleUpdateField}
          onBatchUpdate={handleBatchUpdate}
          onBatchDelete={handleBatchDelete}
          onOpenAuditLog={(id, property) => {
            setAuditListingTarget({ id, property });
            setIsAuditModalOpen(true);
          }}
          sheetCategory={activeSheet}
        />

      </main>

      {/* MODALS */}
      {/* 1. Add / Edit Listing Modal */}
      <ListingFormModal
        isOpen={isAddEditOpen}
        listingToEdit={editingListing}
        onClose={() => setIsAddEditOpen(false)}
        onSave={handleSaveListing}
        nextId={nextAvailableId}
        displayNumber={nextDisplayNumber}
        defaultProjectCategory={activeSheet === 'All' ? 'Project Marketing (PM)' : activeSheet}
      />

      {/* 5. Cloud SQL Audit Trail History Modal */}
      <AuditTrailModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        listingId={auditListingTarget.id}
        listingProperty={auditListingTarget.property}
      />

      <UserManagementModal isOpen={isUserManagementOpen} onClose={() => setIsUserManagementOpen(false)} />
    </div>
  );
}

function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const message = await login(username, password);
    setError(message || '');
    setSubmitting(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100 px-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Property Listing Tracker</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to access your workspace.</p>
        <div className="mt-6 space-y-3">
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" autoComplete="username" required className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          <div className="relative">
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-indigo-600"
              title={showPassword ? 'Hide password' : 'Show password'}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button disabled={submitting} className="w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      </form>
    </div>
  );
}
