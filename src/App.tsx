import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { PropertyListing, FilterState, RenewStatus, ProjectCategory, PROJECT_CATEGORIES } from './types';
import { saveListings } from './utils/storage';
import { autoExpireListings, evaluateListingExpiry, isDatePassed } from './utils/dateUtils';
import { OWNER_SHEET } from './ownerListing';
import { OwnerListingSheet } from './components/OwnerListingSheet';
import { PropertyDetailsModal } from './components/Modals/PropertyDetailsModal';
import { PublicationChannelsModal } from './components/Modals/PublicationChannelsModal';
import { ArchiveModal } from './components/Modals/ArchiveModal';
import { ModalFrame } from './components/Modals/ModalFrame';
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
  const [activeSheet, setActiveSheet] = useState<ProjectCategory | 'All' | typeof OWNER_SHEET>('Project Marketing (PM)');
  const sheetNavigation = useRef<HTMLElement>(null);
  useEffect(() => {
    sheetNavigation.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeSheet]);
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
  const [showArchive,setShowArchive]=useState(false);
  const [archiveSelection,setArchiveSelection]=useState<PropertyListing[]>([]);
  const [archiving,setArchiving]=useState(false);
  const [workspaceError,setWorkspaceError]=useState('');
  const listingsRef=useRef(listings);listingsRef.current=listings;
  const [detailId, setDetailId] = useState<number | null>(null);
  const [showChannels, setShowChannels] = useState(false);
  const [publicationVersion, setPublicationVersion] = useState(0);
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<PropertyListing | null>(null);

  // Audit trail modal state
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [auditListingTarget, setAuditListingTarget] = useState<{ id?: number; property?: string }>({});

  const synchronizeExpiry = useCallback(async (rows:PropertyListing[]) => {
    const {updatedListings}=autoExpireListings(rows);
    return Promise.all(updatedListings.map(async (row)=>{
      const old=rows.find(item=>item.id===row.id)!;
      if(row.status===old.status&&row.renewStatus===old.renewStatus)return old;
      try{return await updateListingInCloudSql(row.id,{status:row.status,renewStatus:row.renewStatus,version:old.version},token,userName);}
      catch{return old;} // Never display an unsaved automatic change or retry with a newer version.
    }));
  },[userName]);
  const refreshListings=useCallback(async()=>{
    setIsRefreshing(true);setWorkspaceError('');
    try{setListings(await synchronizeExpiry(await fetchListingsFromCloudSql()));}
    catch(e){setWorkspaceError((e as Error).message);}
    finally{setIsDbLoaded(true);setIsRefreshing(false);}
  },[synchronizeExpiry]);
  useEffect(()=>{void refreshListings();},[refreshListings]);
  useEffect(()=>{
    let running=false,cancelled=false;
    const timer=setInterval(async()=>{
      if(running)return;running=true;
      try{const before=listingsRef.current;const after=await synchronizeExpiry(before);if(!cancelled)setListings(current=>current.map(row=>{
        const saved=after.find(item=>item.id===row.id);return saved&&(saved.version||0)>(row.version||0)?saved:row;
      }));}finally{running=false;}
    },15000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[synchronizeExpiry]);

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

  const handleSheetChange = (sheet: ProjectCategory | 'All' | typeof OWNER_SHEET) => {
    setActiveSheet(sheet);
    setFilters((prev) => ({ ...prev, projectCategory: 'All', category: 'All' }));
    setActiveFilterTab('all');
  };

  // Add or Edit save with automatic date expiration enforcement and Cloud SQL persistence
  const handleSaveListing = async (listing: PropertyListing) => {
    const checked = evaluateListingExpiry(listing);
    const original = editingListing;
    let saved: PropertyListing;
    if (original) {
      const fields = ['property','projectCategory','location','tenure','pm','negotiator','agent','noTel','availableUnits','status','date','renewStatus','notes','propertyGuruRepostDate','propertyGuruRepostMode','isPriority'] as const;
      const changes = Object.fromEntries(fields.filter(key => checked[key] !== original[key]).map(key => [key, checked[key]]));
      if (Object.keys(changes).length === 0) return;
      saved = await updateListingInCloudSql(original.id, {...changes,version:original.version}, token, userName);
      setListings(prev => prev.map(row => row.id === saved.id ? saved : row));
    } else {
      const {id, ...input} = checked;
      saved = await createListingInCloudSql(input, token, userName);
      setListings(prev => [...prev, saved]);
    }
  };

  const handleDeleteListing=async(id:number)=>{
    const row=listings.find(p=>p.id===id);if(row)setArchiveSelection([row]);
  };

  const handleUpdateField = async (id: number, field: keyof PropertyListing, value: string | boolean, version?:number) => {
    const current=listings.find(row=>row.id===id); if(!current)return;
    const patch:Partial<PropertyListing>={[field]:value,version:version??current.version};
    if(field==='date' && typeof value === 'string') { const checked=evaluateListingExpiry({...current,date:value}); if(checked.status!==current.status)patch.status=checked.status;if(checked.renewStatus!==current.renewStatus)patch.renewStatus=checked.renewStatus; }
    try { const saved=await updateListingInCloudSql(id,patch,token,userName);setListings(prev=>prev.map(row=>row.id===id?saved:row)); }
    catch(e) { throw e; }
  };

  const handleBatchUpdate = async (ids:number[],updates:Partial<PropertyListing>) => {
    const results=await Promise.allSettled(ids.map(id=>updateListingInCloudSql(id,{...updates,version:listings.find(p=>p.id===id)?.version},token,userName)));
    const saved=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
    setListings(prev=>prev.map(row=>saved.find(item=>item.id===row.id)||row));
    if(results.some(result=>result.status==='rejected'))alert('Some changes could not be saved. Refresh and try again.');
  };
  const handleBatchDelete = async (ids:number[]) => {
    setArchiveSelection(listings.filter(row=>ids.includes(row.id)));
  };
  const confirmArchive=async()=>{
    setArchiving(true);setWorkspaceError('');
    const results=await Promise.allSettled(archiveSelection.map(async row=>{await deleteListingFromCloudSql(row.id,token,userName,row.version);return row.id;}));
    const removed=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
    setListings(prev=>prev.filter(row=>!removed.includes(row.id)));
    const failed=results.find(result=>result.status==='rejected');
    if(failed?.status==='rejected')setWorkspaceError(failed.reason.message||'Some properties could not be archived. Refresh and review them.');
    setArchiving(false);setArchiveSelection([]);
  };

  const nextAvailableId = listings.length > 0 ? Math.max(...listings.map((l) => l.id)) + 1 : 1;
  const nextDisplayNumber = sheetListings.length + 1;

  return (
    <div className="flex min-h-[100dvh] w-full min-w-0 flex-col md:h-[100dvh] md:overflow-hidden bg-slate-100 font-sans text-slate-900">
      {/* 1. Header Toolbar */}
      <Header
        ownerMode={activeSheet === OWNER_SHEET}
        onOpenPublicationChannels={() => setShowChannels(true)}
        onOpenArchive={()=>setShowArchive(true)}
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

      <nav ref={sheetNavigation} className="flex shrink-0 items-end gap-1 overflow-x-auto border-b border-slate-300 bg-slate-200 px-4 pt-2" aria-label="Listing sheets">
        <button
          onClick={() => handleSheetChange('All')}
          aria-current={activeSheet === 'All' ? 'page' : undefined}
          className={`shrink-0 whitespace-nowrap rounded-t-md border border-b-0 px-4 py-2 text-xs font-semibold transition-colors ${
            activeSheet === 'All'
              ? 'border-slate-300 bg-white text-indigo-700'
              : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          All Listings
        </button>
        {[...PROJECT_CATEGORIES, OWNER_SHEET].map((category) => (
          <button
            key={category}
            onClick={() => handleSheetChange(category)}
            aria-current={activeSheet === category ? 'page' : undefined}
            className={`shrink-0 whitespace-nowrap rounded-t-md border border-b-0 px-4 py-2 text-xs font-semibold transition-colors ${
              activeSheet === category
                ? 'border-slate-300 bg-white text-indigo-700'
                : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {category}
          </button>
        ))}
      </nav>

      {workspaceError&&<p role="alert" className="px-4 py-2 bg-rose-50 text-rose-700">{workspaceError} <button className="underline" onClick={refreshListings}>Refresh listings</button></p>}
      {/* 2. Optional Top KPI Metric Highlights */}
      {showKPIMetrics && activeSheet !== OWNER_SHEET && (
        <KPIMetrics
          listings={sheetListings}
          onFilterChange={handleKPITabChange}
          activeFilterTab={activeFilterTab}
        />
      )}

      {/* 3. Main Workspace: Master Spreadsheet Grid & Optional AI Studio Assistant Sidebar */}
      <main className="flex min-h-0 min-w-0 flex-1 md:overflow-hidden">
        {/* Master Spreadsheet Table Area */}
        {activeSheet === OWNER_SHEET ? <OwnerListingSheet /> : <MasterPropertyGrid
          listings={sheetListings}
          publicationVersion={publicationVersion}
          onViewListing={item => setDetailId(item.id)}
          filters={filters}
          onFilterChange={handleFilterChange}
          onEditListing={(item) => {
            setEditingListing(item);
            setIsAddEditOpen(true);
          }}
          onDeleteListing={handleDeleteListing}
          onUpdateField={handleUpdateField}
          onBatchUpdate={handleBatchUpdate}
          onBatchDelete={handleBatchDelete}
          onOpenAuditLog={(id, property) => {
            setAuditListingTarget({ id, property });
            setIsAuditModalOpen(true);
          }}
          sheetCategory={activeSheet}
        />}

      </main>

      {detailId !== null && listings.find(row => row.id === detailId) && <PropertyDetailsModal key={detailId} listing={listings.find(row => row.id === detailId)!} onClose={() => setDetailId(null)} onEditListing={item => {setEditingListing(item);setIsAddEditOpen(true);}} onChanged={() => setPublicationVersion(n => n + 1)}/>}
      {showArchive&&<ArchiveModal onClose={()=>setShowArchive(false)} onRestored={refreshListings}/>}
      {archiveSelection.length>0&&<ModalFrame title="Archive properties?" subtitle="Their details, published ads and history will be retained." onClose={()=>{if(!archiving)setArchiveSelection([]);}}>
        <p className="mb-4">Archive {archiveSelection.length===1?archiveSelection[0].property:`${archiveSelection.length} selected properties`}? You can restore them from Archived properties.</p>
        <div className="flex justify-end gap-2"><button className="ui-button" disabled={archiving} onClick={()=>setArchiveSelection([])}>Cancel</button><button className="ui-button bg-indigo-600 text-white" disabled={archiving} onClick={confirmArchive}>{archiving?'Archiving…':'Confirm archive'}</button></div>
      </ModalFrame>}
      {showChannels && <PublicationChannelsModal onClose={() => setShowChannels(false)} onChanged={() => setPublicationVersion(n => n + 1)}/>}
      {/* MODALS */}
      {/* 1. Add / Edit Listing Modal */}
      <ListingFormModal
        isOpen={isAddEditOpen}
        listingToEdit={editingListing}
        onClose={() => setIsAddEditOpen(false)}
        onSave={handleSaveListing}
        nextId={nextAvailableId}
        displayNumber={nextDisplayNumber}
        defaultProjectCategory={activeSheet === 'All' || activeSheet === OWNER_SHEET ? 'Project Marketing (PM)' : activeSheet}
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100 px-4 py-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 shadow-sm">
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
