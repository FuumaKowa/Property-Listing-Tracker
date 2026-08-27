import React, { useState, useEffect } from 'react';
import { PropertyListing, FilterState, ExtractionResult, RenewStatus } from './types';
import { loadListings, saveListings } from './utils/storage';
import { Header } from './components/Header';
import { KPIMetrics } from './components/KPIMetrics';
import { MasterPropertyGrid } from './components/MasterPropertyGrid';
import { SidebarAssistant } from './components/SidebarAssistant';
import { AIExtractModal } from './components/Modals/AIExtractModal';
import { PMAlertModal } from './components/Modals/PMAlertModal';
import { StandardizeModal } from './components/Modals/StandardizeModal';
import { ListingFormModal } from './components/Modals/ListingFormModal';

export default function App() {
  const [listings, setListings] = useState<PropertyListing[]>(() => loadListings());
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
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

  // Add or Edit save
  const handleSaveListing = (listing: PropertyListing) => {
    setListings((prev) => {
      const existsIndex = prev.findIndex((l) => l.id === listing.id);
      if (existsIndex >= 0) {
        const updated = [...prev];
        updated[existsIndex] = listing;
        return updated;
      }
      return [...prev, listing];
    });
  };

  const handleDeleteListing = (id: number) => {
    if (window.confirm(`Are you sure you want to delete listing #${id}?`)) {
      setListings((prev) => prev.filter((l) => l.id !== id));
    }
  };

  const handleToggleRenewStatus = (id: number) => {
    setListings((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          let nextRenew: RenewStatus = 'Renewed';
          if (l.renewStatus === 'Renewed') {
            nextRenew = 'Want to be renew';
          } else if (l.renewStatus === 'Want to be renew') {
            nextRenew = 'Not Renewed';
          } else {
            nextRenew = 'Renewed';
          }

          return {
            ...l,
            renewStatus: nextRenew,
            status: nextRenew === 'Renewed' ? 'Active' : l.status,
          };
        }
        return l;
      })
    );
  };

  const handleToggleStatus = (id: number) => {
    setListings((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          const nextStatus = l.status === 'Active' ? 'Expired' : 'Active';
          return {
            ...l,
            status: nextStatus,
          };
        }
        return l;
      })
    );
  };

  const handleUpdateField = (id: number, field: keyof PropertyListing, value: string) => {
    setListings((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          return {
            ...l,
            [field]: value,
          };
        }
        return l;
      })
    );
  };

  const handleDraftPMAlert = (listing: PropertyListing) => {
    setAlertListing(listing);
    setIsAlertModalOpen(true);
  };

  const handleMarkRenewedFromAlert = (listingId: number) => {
    setListings((prev) =>
      prev.map((l) =>
        l.id === listingId ? { ...l, renewStatus: 'Renewed', status: 'Active' } : l
      )
    );
  };

  // Batch operations
  const handleBatchUpdate = (ids: number[], updates: Partial<PropertyListing>) => {
    setListings((prev) =>
      prev.map((l) => (ids.includes(l.id) ? { ...l, ...updates } : l))
    );
  };

  const handleBatchDelete = (ids: number[]) => {
    setListings((prev) => prev.filter((l) => !ids.includes(l.id)));
  };

  // Add extracted listings from AI modal
  const handleAddExtractedListings = (extracted: ExtractionResult[]) => {
    let nextId = listings.length > 0 ? Math.max(...listings.map((l) => l.id)) + 1 : 1;
    const newListings: PropertyListing[] = extracted.map((e) => ({
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
    setListings((prev) => [...prev, ...newListings]);
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
    </div>
  );
}
