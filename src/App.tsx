import React, { useState, useEffect, useCallback } from 'react';
import { PropertyListing, FilterState, ExtractionResult, RenewStatus } from './types';
import { loadListings, saveListings } from './utils/storage';
import { autoExpireListings, evaluateListingExpiry, isDatePassed } from './utils/dateUtils';
import { Header } from './components/Header';
import { KPIMetrics } from './components/KPIMetrics';
import { MasterPropertyGrid } from './components/MasterPropertyGrid';
import { SidebarAssistant } from './components/SidebarAssistant';
import { AIExtractModal } from './components/Modals/AIExtractModal';
import { PMAlertModal } from './components/Modals/PMAlertModal';
import { StandardizeModal } from './components/Modals/StandardizeModal';
import { ListingFormModal } from './components/Modals/ListingFormModal';
import { AuditTrailModal } from './components/Modals/AuditTrailModal';
import { useAuth } from './context/AuthContext';
import {
  fetchListingsFromCloudSql,
  createListingInCloudSql,
  updateListingInCloudSql,
  deleteListingFromCloudSql,
} from './services/api';

export default function App() {
  const { userName, currentUser, token, loading, signInWithGoogle } = useAuth();
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
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
  const [showAIAssistant, setShowAIAssistant] = useState<boolean>(false);

  // Modal States
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<PropertyListing | null>(null);

  const [isExtractOpen, setIsExtractOpen] = useState(false);
  const [extractInitialText, setExtractInitialText] = useState('');

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertListing, setAlertListing] = useState<PropertyListing | null>(null);

  const [isStandardizeOpen, setIsStandardizeOpen] = useState(false);

  // Audit trail modal state
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditListingTarget, setAuditListingTarget] = useState<{ id?: number; property?: string }>({});

  // Initial load from Cloud SQL
  useEffect(() => {
    if (!currentUser || !token) {
      setListings([]);
      setIsDbLoaded(true);
      return;
    }

    setIsDbLoaded(false);
    fetchListingsFromCloudSql(token)
      .then((dbListings) => {
        if (dbListings && dbListings.length > 0) {
          const { updatedListings } = autoExpireListings(dbListings);
          setListings(updatedListings);
          saveListings(updatedListings);
        } else {
          setListings([]);
        }
      })
      .catch((err) => {
        console.warn('Could not load user listings from Cloud SQL:', err);
        setListings([]);
      })
      .finally(() => {
        setIsDbLoaded(true);
      });
  }, [token, userName, currentUser?.email]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100 text-slate-700">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm font-medium">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100 px-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M7 18a4 4 0 0 1 8 0M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Sign in to continue</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your property data is kept separate per account, so each user only sees their own listings.
          </p>
          <button
            onClick={signInWithGoogle}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M21.6 12.23c0-.69-.06-1.35-.18-1.99H12v3.77h5.39a4.6 4.6 0 0 1-1.98 3.02v2.5h3.2c1.88-1.73 2.99-4.29 2.99-7.3Z" />
              <path d="M12 22c2.7 0 4.95-.9 6.6-2.43l-3.2-2.5c-.9.6-2.05.96-3.4.96-2.6 0-4.8-1.76-5.58-4.13H.9v2.6A10 10 0 0 0 12 22Z" />
              <path d="M6.42 19.89A6.02 6.02 0 0 1 6 16.6V14h-2.6A6.27 6.27 0 0 0 .9 17.7c.84 1.7 2.06 3.13 3.52 4.19Z" />
              <path d="M12 4.98c1.18 0 2.25.41 3.09 1.21l2.31-2.31A9.95 9.95 0 0 0 12 2a10 10 0 0 0-9.1 5.52L5.5 8.12A6 6 0 0 1 12 4.98Z" />
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // Periodic automatic date check: ensures status is synchronized with listing date (Active if not passed, Expired if passed)
  useEffect(() => {
    const checkDateSync = () => {
      setListings((prev) => {
        const { updatedListings, changedCount } = autoExpireListings(prev);
        if (changedCount > 0) {
          return updatedListings;
        }
        return prev;
      });
    };

    checkDateSync();
    const interval = setInterval(checkDateSync, 15000);
    return () => clearInterval(interval);
  }, []);

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

  // Add or Edit save with automatic date expiration enforcement and Cloud SQL persistence
  const handleSaveListing = async (listing: PropertyListing) => {
    const checked = evaluateListingExpiry({
      ...listing,
      updatedByName: userName || 'Team Member',
      updatedByEmail: currentUser?.email || undefined,
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
        await updateListingInCloudSql(checked.id, checked, token, userName, currentUser?.email || undefined);
      } else {
        const { id, ...createData } = checked;
        const saved = await createListingInCloudSql(createData, token, userName, currentUser?.email || undefined);
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
              updatedByEmail: currentUser?.email || undefined,
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
          updatedByEmail: currentUser?.email || undefined,
          lastUpdatedAt: nowIso,
        },
        token,
        userName,
        currentUser?.email || undefined
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
              updatedByEmail: currentUser?.email || undefined,
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
          updatedByEmail: currentUser?.email || undefined,
          lastUpdatedAt: nowIso,
        },
        token,
        userName,
        currentUser?.email || undefined
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
      updatedByEmail: currentUser?.email || undefined,
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
          updatedByEmail: currentUser?.email || undefined,
          lastUpdatedAt: updated.lastUpdatedAt,
        },
        token,
        userName,
        currentUser?.email || undefined
      );
    } catch (err) {
      console.warn('Cloud SQL update field warning:', err);
    }
  };

  const handleDraftPMAlert = (listing: PropertyListing) => {
    setAlertListing(listing);
    setIsAlertModalOpen(true);
  };

  const handleMarkRenewedFromAlert = (listingId: number) => {
    setListings((prev) =>
      prev.map((l) => {
        if (l.id === listingId) {
          const datePassed = isDatePassed(l.date);
          return {
            ...l,
            renewStatus: 'Renewed',
            status: datePassed ? 'Expired' : 'Active',
          };
        }
        return l;
      })
    );
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

  // Add extracted listings from AI modal with auto-expiry check
  const handleAddExtractedListings = (extracted: ExtractionResult[]) => {
    let nextId = listings.length > 0 ? Math.max(...listings.map((l) => l.id)) + 1 : 1;
    const rawListings: PropertyListing[] = extracted.map((e) => ({
      id: nextId++,
      property: e.property,
      location: e.location,
      tenure: e.tenure,
      pm: e.pm,
      availableUnits: e.availableUnits,
      status: e.status,
      date: e.date,
      renewStatus: e.renewStatus,
      notes: e.confidenceNotes,
    }));
    const { updatedListings } = autoExpireListings(rawListings);
    setListings((prev) => [...prev, ...updatedListings]);
  };

  // Apply Standardization changes
  const handleApplyStandardization = (
    updates: { id: number; location: string; tenure: string }[]
  ) => {
    setListings((prev) =>
      prev.map((l) => {
        const update = updates.find((u) => u.id === l.id);
        if (update) {
          return {
            ...l,
            location: update.location,
            tenure: update.tenure,
          };
        }
        return l;
      })
    );
  };

  const nextAvailableId = listings.length > 0 ? Math.max(...listings.map((l) => l.id)) + 1 : 1;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 text-slate-900 font-sans overflow-hidden">
      {/* 1. Header Toolbar */}
      <Header
        listings={listings}
        showKPIMetrics={showKPIMetrics}
        showAIAssistant={showAIAssistant}
        onToggleKPIMetrics={() => setShowKPIMetrics((prev) => !prev)}
        onToggleAIAssistant={() => setShowAIAssistant((prev) => !prev)}
        onOpenAddModal={() => {
          setEditingListing(null);
          setIsAddEditOpen(true);
        }}
        onOpenExtractModal={() => {
          setExtractInitialText('');
          setIsExtractOpen(true);
        }}
        onOpenStandardizeModal={() => setIsStandardizeOpen(true)}
        onOpenAuditModal={() => {
          setAuditListingTarget({});
          setIsAuditModalOpen(true);
        }}
        onListingsUpdated={(newListings) => setListings(newListings)}
      />

      {/* 2. Optional Top KPI Metric Highlights */}
      {showKPIMetrics && (
        <KPIMetrics
          listings={listings}
          onFilterChange={handleKPITabChange}
          activeFilterTab={activeFilterTab}
        />
      )}

      {/* 3. Main Workspace: Master Spreadsheet Grid & Optional AI Studio Assistant Sidebar */}
      <main className="flex-1 flex overflow-hidden">
        {/* Master Spreadsheet Table Area */}
        <MasterPropertyGrid
          listings={listings}
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
          onDraftPMAlert={handleDraftPMAlert}
          onBatchUpdate={handleBatchUpdate}
          onBatchDelete={handleBatchDelete}
          onOpenAuditLog={(id, property) => {
            setAuditListingTarget({ id, property });
            setIsAuditModalOpen(true);
          }}
        />

        {/* AI Studio Assistant Sidebar (Collapsible) */}
        {showAIAssistant && (
          <SidebarAssistant
            listings={listings}
            onDraftPMAlert={handleDraftPMAlert}
            onOpenExtractModal={(initText) => {
              setExtractInitialText(initText || '');
              setIsExtractOpen(true);
            }}
            onFilterByPM={(pmName) => {
              setFilters((prev) => ({ ...prev, pm: pmName }));
              setActiveFilterTab('custom');
            }}
            onFilterByStatus={(statusName) => {
              setFilters((prev) => ({ ...prev, status: statusName }));
              setActiveFilterTab('custom');
            }}
          />
        )}
      </main>

      {/* MODALS */}
      {/* 1. Add / Edit Listing Modal */}
      <ListingFormModal
        isOpen={isAddEditOpen}
        listingToEdit={editingListing}
        onClose={() => setIsAddEditOpen(false)}
        onSave={handleSaveListing}
        nextId={nextAvailableId}
      />

      {/* 2. AI Structured Extraction Modal (Text-to-Table) */}
      <AIExtractModal
        isOpen={isExtractOpen}
        initialText={extractInitialText}
        onClose={() => setIsExtractOpen(false)}
        onAddExtractedListings={handleAddExtractedListings}
      />

      {/* 3. PM Renewal Notice Generator Modal */}
      <PMAlertModal
        isOpen={isAlertModalOpen}
        listing={alertListing}
        onClose={() => setIsAlertModalOpen(false)}
        onMarkRenewed={handleMarkRenewedFromAlert}
      />

      {/* 4. Location & Tenure Standardization Modal */}
      <StandardizeModal
        isOpen={isStandardizeOpen}
        listings={listings}
        onClose={() => setIsStandardizeOpen(false)}
        onApplyStandardization={handleApplyStandardization}
      />

      {/* 5. Cloud SQL Audit Trail History Modal */}
      <AuditTrailModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        listingId={auditListingTarget.id}
        listingProperty={auditListingTarget.property}
      />
    </div>
  );
}
