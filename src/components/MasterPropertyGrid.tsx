import React, { useState, useMemo } from 'react';
import { PropertyListing, FilterState, ProjectCategory, PROJECT_CATEGORIES } from '../types';
import { getDateStatusInfo, isDatePassed } from '../utils/dateUtils';
import {
  Search,
  ChevronDown,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Sparkles,
  ArrowUpDown,
  Filter,
  History,
  User,
  Tag,
} from 'lucide-react';

export const getCategoryBadgeStyle = (category?: string) => {
  switch (category) {
    case 'Project Marketing (PM)':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Rental':
      return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'Subsale CoA (SSCOA)':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Subsale Direct Listing (SSDL)':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'Million Dollar Property (MD)':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Auction':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

interface MasterPropertyGridProps {
  listings: PropertyListing[];
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  onEditListing: (listing: PropertyListing) => void;
  onDeleteListing: (id: number) => void;
  onToggleRenewStatus: (id: number) => void;
  onToggleStatus?: (id: number) => void;
  onUpdateField?: (id: number, field: keyof PropertyListing, value: string) => void;
  onBatchUpdate: (ids: number[], updates: Partial<PropertyListing>) => void;
  onBatchDelete: (ids: number[]) => void;
  onOpenAuditLog?: (listingId: number, propertyName: string) => void;
  sheetCategory?: string;
}

export const MasterPropertyGrid: React.FC<MasterPropertyGridProps> = ({
  listings,
  filters,
  onFilterChange,
  onEditListing,
  onDeleteListing,
  onToggleRenewStatus,
  onToggleStatus,
  onUpdateField,
  onBatchUpdate,
  onBatchDelete,
  onOpenAuditLog,
  sheetCategory = 'All',
}) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editingCell, setEditingCell] = useState<{ id: number; field: keyof PropertyListing } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const usesNegotiatorLabel = sheetCategory === 'Rental' || sheetCategory === 'Subsale CoA (SSCOA)';
  const peopleColumnLabel = usesNegotiatorLabel ? 'Negotiator / Agent / No Tel' : 'PM';

  // Unique list for PM and Location dropdowns
  const uniquePMs = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => {
      if (l.pm && l.pm !== '-') {
        l.pm.split('/').forEach((p) => set.add(p.trim()));
        set.add(l.pm.trim());
      }
    });
    return Array.from(set).sort();
  }, [listings]);

  // Filtered & Sorted listings
  const filteredListings = useMemo(() => {
    return listings
      .filter((item) => {
        // Search query
        if (filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          const matchProp = (item.property || '').toLowerCase().includes(q);
          const matchCategory = (item.projectCategory || '').toLowerCase().includes(q);
          const matchLoc = (item.location || '').toLowerCase().includes(q);
          const matchPM = (item.pm || '').toLowerCase().includes(q);
          const matchTenure = (item.tenure || '').toLowerCase().includes(q);
          if (!matchProp && !matchCategory && !matchLoc && !matchPM && !matchTenure) return false;
        }

        // Project Category filter
        const selectedCat = filters.projectCategory || filters.category;
        if (selectedCat && selectedCat !== 'All') {
          if (item.projectCategory !== selectedCat) return false;
        }

        // Status filter
        if (filters.status && filters.status !== 'All') {
          if (item.status !== filters.status) return false;
        }

        // Renew Status filter
        if (filters.renewStatus && filters.renewStatus !== 'All') {
          if (item.renewStatus !== filters.renewStatus) return false;
        }

        // PM filter
        if (filters.pm && filters.pm !== 'All') {
          if (!(item.pm || '').toLowerCase().includes(filters.pm.toLowerCase())) return false;
        }

        // Tenure filter
        if (filters.tenure && filters.tenure !== 'All') {
          if (filters.tenure === 'FMR') {
            if (!(item.tenure || '').toLowerCase().includes('malay reserved')) return false;
          } else if (item.tenure !== filters.tenure) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const fieldA = a[filters.sortBy];
        const fieldB = b[filters.sortBy];

        if (fieldA == null) return 1;
        if (fieldB == null) return -1;

        if (typeof fieldA === 'number' && typeof fieldB === 'number') {
          return filters.sortOrder === 'asc' ? fieldA - fieldB : fieldB - fieldA;
        }

        const comp = String(fieldA).localeCompare(String(fieldB));
        return filters.sortOrder === 'asc' ? comp : -comp;
      });
  }, [listings, filters]);

  // Handle Sort column click
  const handleSort = (field: keyof PropertyListing) => {
    if (filters.sortBy === field) {
      onFilterChange({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      onFilterChange({ sortBy: field, sortOrder: 'asc' });
    }
  };

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredListings.map((l) => l.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const startEdit = (id: number, field: keyof PropertyListing, currentValue: string) => {
    setEditingCell({ id, field });
    setEditValue(currentValue);
  };

  const saveEdit = () => {
    if (editingCell && onUpdateField) {
      onUpdateField(editingCell.id, editingCell.field, editValue);
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Top Lightweight Filter & Action Bar */}
      <div className="bg-slate-50 px-4 py-2 flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
              placeholder="Search properties, locations, or PMs..."
              className="text-xs pl-8 pr-2.5 py-1.5 border border-slate-300 rounded outline-none w-full bg-white text-slate-800 placeholder-slate-400 focus:border-indigo-600"
            />
          </div>

          {/* Quick Project Category Dropdown */}
          <select
            value={filters.projectCategory || filters.category || 'All'}
            onChange={(e) =>
              onFilterChange({ projectCategory: e.target.value, category: e.target.value })
            }
            className="text-xs px-2 py-1.5 border border-slate-300 rounded outline-none bg-white text-slate-700 focus:border-indigo-600 cursor-pointer"
            title="Filter by Project Category"
          >
            <option value="All">All Categories</option>
            {PROJECT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Quick PM Dropdown */}
          <select
            value={filters.pm}
            onChange={(e) => onFilterChange({ pm: e.target.value })}
            className="text-xs px-2 py-1.5 border border-slate-300 rounded outline-none bg-white text-slate-700 focus:border-indigo-600 cursor-pointer"
          >
            <option value="All">{usesNegotiatorLabel ? 'All Negotiators / Agents' : 'All PMs'}</option>
            {uniquePMs.map((pm) => (
              <option key={pm} value={pm}>
                {pm}
              </option>
            ))}
          </select>

          {/* Quick Status Dropdown */}
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value })}
            className="text-xs px-2 py-1.5 border border-slate-300 rounded outline-none bg-white text-slate-700 focus:border-indigo-600 cursor-pointer"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
          </select>

          {/* Quick Renew Status Dropdown */}
          <select
            value={filters.renewStatus}
            onChange={(e) => onFilterChange({ renewStatus: e.target.value })}
            className="text-xs px-2 py-1.5 border border-slate-300 rounded outline-none bg-white text-slate-700 focus:border-indigo-600 cursor-pointer"
          >
            <option value="All">All Renewals</option>
            <option value="Renewed">Renewed</option>
            <option value="Want to be renew">Want to be renew</option>
            <option value="Not Renewed">Not Renewed</option>
          </select>
        </div>

        {/* Count and Clear */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-800 font-semibold">{filteredListings.length}</strong> of{' '}
            {listings.length} rows
          </span>
          {(filters.searchQuery ||
            (filters.projectCategory && filters.projectCategory !== 'All') ||
            (filters.category && filters.category !== 'All') ||
            filters.pm !== 'All' ||
            filters.tenure !== 'All' ||
            filters.status !== 'All' ||
            filters.renewStatus !== 'All') && (
            <button
              onClick={() =>
                onFilterChange({
                  searchQuery: '',
                  projectCategory: 'All',
                  category: 'All',
                  pm: 'All',
                  tenure: 'All',
                  status: 'All',
                  renewStatus: 'All',
                })
              }
              className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Batch Operations Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-[#3c437a] text-white px-4 py-1.5 flex items-center justify-between text-xs shrink-0">
          <span className="font-semibold">{selectedIds.length} rows selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onBatchUpdate(selectedIds, { renewStatus: 'Renewed', status: 'Active' });
                setSelectedIds([]);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded text-xs font-medium cursor-pointer"
            >
              Mark Renewed
            </button>
            <button
              onClick={() => {
                onBatchUpdate(selectedIds, { renewStatus: 'Want to be renew' });
                setSelectedIds([]);
              }}
              className="bg-orange-500 hover:bg-orange-600 px-2.5 py-1 rounded text-xs font-medium cursor-pointer"
            >
              Mark Want to Renew
            </button>
            <button
              onClick={() => {
                onBatchUpdate(selectedIds, { status: 'Expired', renewStatus: 'Not Renewed' });
                setSelectedIds([]);
              }}
              className="bg-rose-600 hover:bg-rose-700 px-2.5 py-1 rounded text-xs font-medium cursor-pointer"
            >
              Mark Expired
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete ${selectedIds.length} listings?`)) {
                  onBatchDelete(selectedIds);
                  setSelectedIds([]);
                }
              }}
              className="bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded text-xs font-medium cursor-pointer"
            >
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-slate-300 hover:text-white underline ml-2 cursor-pointer"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Spreadsheet Container with Centered Header Title */}
      <div className="flex-1 overflow-auto bg-slate-50 p-4">
        <div className="max-w-[1800px] mx-auto bg-white shadow-xs border border-slate-300 rounded-sm overflow-hidden">
          {/* Centered Tracker Title Bar exactly like the user's uploaded spreadsheet */}
          <div className="bg-white py-2.5 text-center border-b border-slate-300">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Property Listing Tracker
            </h1>
          </div>

          {/* Master Spreadsheet Table */}
          <table className="w-full min-w-[1700px] text-left border-collapse text-[13px]">
            {/* Dark Purple-Blue Header row (#434a78) */}
            <thead>
              <tr className="bg-[#434a78] text-white font-bold border-b border-slate-300 text-xs sm:text-[13px] select-none">
                <th className="border border-slate-400/50 px-2 py-2 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredListings.length > 0 &&
                      selectedIds.length === filteredListings.length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                    title="Select all"
                  />
                </th>
                <th
                  onClick={() => handleSort('id')}
                  className="border border-slate-400/50 px-2.5 py-2 w-12 text-center cursor-pointer hover:bg-[#383e66]"
                >
                  No.
                </th>
                <th
                  onClick={() => handleSort('property')}
                  className="border border-slate-400/50 px-3 py-2 min-w-[220px] cursor-pointer hover:bg-[#383e66]"
                >
                  Property
                </th>
                <th
                  onClick={() => handleSort('projectCategory')}
                  className="border border-slate-400/50 px-3 py-2 min-w-[200px] cursor-pointer hover:bg-[#383e66]"
                >
                  Project Category
                </th>
                <th
                  onClick={() => handleSort('location')}
                  className="border border-slate-400/50 px-3 py-2 min-w-[260px] cursor-pointer hover:bg-[#383e66]"
                >
                  Location
                </th>
                <th
                  onClick={() => handleSort('tenure')}
                  className="border border-slate-400/50 px-3 py-2 min-w-[160px] cursor-pointer hover:bg-[#383e66]"
                >
                  Tenure
                </th>
                {usesNegotiatorLabel ? (
                  <>
                    <th className="border border-slate-400/50 px-3 py-2 min-w-[150px] cursor-pointer hover:bg-[#383e66]">Negotiator</th>
                    <th className="border border-slate-400/50 px-3 py-2 min-w-[150px] cursor-pointer hover:bg-[#383e66]">Agent</th>
                    <th className="border border-slate-400/50 px-3 py-2 min-w-[140px] cursor-pointer hover:bg-[#383e66]">No Tel</th>
                  </>
                ) : (
                  <th
                    onClick={() => handleSort('pm')}
                    className="border border-slate-400/50 px-3 py-2 min-w-[150px] cursor-pointer hover:bg-[#383e66]"
                  >
                    {peopleColumnLabel}
                  </th>
                )}
                <th
                  onClick={() => handleSort('availableUnits')}
                  className="border border-slate-400/50 px-3 py-2 min-w-[130px] cursor-pointer hover:bg-[#383e66]"
                >
                  Available Units
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="border border-slate-400/50 px-2.5 py-2 w-28 text-center cursor-pointer hover:bg-[#383e66]"
                >
                  Status
                </th>
                <th
                  onClick={() => handleSort('date')}
                  className="border border-slate-400/50 px-2.5 py-2 w-20 text-center cursor-pointer hover:bg-[#383e66]"
                >
                  Date
                </th>
                <th
                  onClick={() => handleSort('renewStatus')}
                  className="border border-slate-400/50 px-2.5 py-2 w-32 text-center cursor-pointer hover:bg-[#383e66]"
                >
                  Renew Status
                </th>
                <th
                  onClick={() => handleSort('lastUpdatedAt')}
                  className="border border-slate-400/50 px-2.5 py-2 min-w-[170px] text-left cursor-pointer hover:bg-[#383e66]"
                  title="Who updated the listing and when"
                >
                  Updated By & When
                </th>
                <th className="border border-slate-400/50 px-2 py-2 w-14 text-center">
                  Edit
                </th>
              </tr>
            </thead>

            {/* Table Body with authentic spreadsheet cell borders and background colors */}
            <tbody className="divide-y divide-slate-300 text-slate-900">
              {filteredListings.length === 0 ? (
                <tr>
                  <td colSpan={usesNegotiatorLabel ? 15 : 13} className="border border-slate-300 px-4 py-8 text-center text-slate-500">
                    No listings match the current filters.
                  </td>
                </tr>
              ) : (
                filteredListings.map((item, rowIndex) => {
                  const isSelected = selectedIds.includes(item.id);
                  // In the spreadsheet: Renewed is pale green (#e2efda), Want to be renew is vibrant orange (#fed7aa)
                  const isRenewed = item.renewStatus === 'Renewed';
                  const isWantToRenew = item.renewStatus === 'Want to be renew';
                  const rowBgClass = isSelected
                    ? 'bg-indigo-100/70'
                    : isWantToRenew
                    ? 'bg-[#fed7aa]'
                    : isRenewed
                    ? 'bg-[#e2efda]'
                    : 'bg-white';

                  return (
                    <tr
                      key={item.id}
                      className={`${rowBgClass} hover:brightness-95 transition-all text-xs sm:text-[13px]`}
                    >
                      {/* Checkbox */}
                      <td className="border border-slate-300 px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* No. */}
                      <td className="border border-slate-300 px-2.5 py-1.5 text-center font-normal text-slate-700">
                        {rowIndex + 1}
                      </td>

                      {/* Property */}
                      <td
                        onDoubleClick={() => startEdit(item.id, 'property', item.property)}
                        className="border border-slate-300 px-3 py-1.5 font-normal text-slate-900"
                        title="Double-click to edit inline"
                      >
                        {editingCell?.id === item.id && editingCell?.field === 'property' ? (
                          <input
                            type="text"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleKeyDown}
                            className="w-full text-xs p-1 border border-indigo-500 rounded bg-white"
                          />
                        ) : (
                          item.property
                        )}
                      </td>

                      {/* Project Category */}
                      <td
                        className="border border-slate-300 px-2.5 py-1.5"
                        title="Double-click to change category"
                      >
                        {editingCell?.id === item.id && editingCell?.field === 'projectCategory' ? (
                          <select
                            autoFocus
                            value={editValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditValue(val);
                              if (onUpdateField) {
                                onUpdateField(item.id, 'projectCategory', val);
                              }
                              setEditingCell(null);
                            }}
                            onBlur={() => setEditingCell(null)}
                            className="w-full text-xs p-1 border border-indigo-500 rounded bg-white font-medium text-slate-800"
                          >
                            {PROJECT_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div
                            onDoubleClick={() =>
                              startEdit(item.id, 'projectCategory', item.projectCategory || 'Project Marketing (PM)')
                            }
                            className="flex items-center gap-1.5 cursor-pointer"
                          >
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${getCategoryBadgeStyle(
                                item.projectCategory
                              )}`}
                            >
                              {item.projectCategory || 'Project Marketing (PM)'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Location */}
                      <td
                        onDoubleClick={() => startEdit(item.id, 'location', item.location)}
                        className="border border-slate-300 px-3 py-1.5 text-slate-800"
                        title="Double-click to edit inline"
                      >
                        {editingCell?.id === item.id && editingCell?.field === 'location' ? (
                          <input
                            type="text"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleKeyDown}
                            className="w-full text-xs p-1 border border-indigo-500 rounded bg-white"
                          />
                        ) : (
                          item.location
                        )}
                      </td>

                      {/* Tenure */}
                      <td
                        onDoubleClick={() => startEdit(item.id, 'tenure', item.tenure)}
                        className="border border-slate-300 px-3 py-1.5 text-slate-800"
                        title="Double-click to edit inline"
                      >
                        {editingCell?.id === item.id && editingCell?.field === 'tenure' ? (
                          <select
                            autoFocus
                            value={editValue}
                            onChange={(e) => {
                              setEditValue(e.target.value);
                              if (onUpdateField) onUpdateField(item.id, 'tenure', e.target.value);
                              setEditingCell(null);
                            }}
                            onBlur={() => setEditingCell(null)}
                            className="w-full text-xs p-1 border border-indigo-500 rounded bg-white"
                          >
                            <option value="Freehold">Freehold</option>
                            <option value="Leasehold">Leasehold</option>
                            <option value="Freehold Malay Reserved">Freehold Malay Reserved</option>
                            <option value="-">-</option>
                          </select>
                        ) : (
                          item.tenure
                        )}
                      </td>

                      {/* PM or Rental/Subsale CoA contacts */}
                      {usesNegotiatorLabel ? (
                        ([
                          ['negotiator', item.negotiator || '-'],
                          ['agent', item.agent || '-'],
                          ['noTel', item.noTel || '-'],
                        ] as [keyof PropertyListing, string][]).map(([field, value]) => (
                          <td
                            key={field}
                            onDoubleClick={() => startEdit(item.id, field, value)}
                            className="border border-slate-300 px-3 py-1.5 text-slate-800"
                            title="Double-click to edit inline"
                          >
                            {editingCell?.id === item.id && editingCell?.field === field ? (
                              <input
                                type="text"
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={handleKeyDown}
                                className="w-full text-xs p-1 border border-indigo-500 rounded bg-white"
                              />
                            ) : value}
                          </td>
                        ))
                      ) : (
                        <td
                          onDoubleClick={() => startEdit(item.id, 'pm', item.pm)}
                          className="border border-slate-300 px-3 py-1.5 text-slate-800"
                          title="Double-click to edit inline"
                        >
                          {editingCell?.id === item.id && editingCell?.field === 'pm' ? (
                            <input
                              type="text"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={saveEdit}
                              onKeyDown={handleKeyDown}
                              className="w-full text-xs p-1 border border-indigo-500 rounded bg-white"
                            />
                          ) : item.pm}
                        </td>
                      )}

                      {/* Available Units */}
                      <td
                        onDoubleClick={() => startEdit(item.id, 'availableUnits', item.availableUnits)}
                        className="border border-slate-300 px-3 py-1.5 text-slate-800 font-normal"
                        title="Double-click to edit inline"
                      >
                        {editingCell?.id === item.id && editingCell?.field === 'availableUnits' ? (
                          <input
                            type="text"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleKeyDown}
                            className="w-full text-xs p-1 border border-indigo-500 rounded bg-white"
                          />
                        ) : (
                          item.availableUnits
                        )}
                      </td>

                      {/* Status (Dropdown Pill exactly matching the image) */}
                      <td className="border border-slate-300 px-2 py-1.5 text-center">
                        {(() => {
                          const dateStatus = getDateStatusInfo(item.date);
                          return (
                            <div className="inline-flex items-center justify-center relative">
                              <select
                                value={item.status}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === 'Active' && dateStatus.isPassed) {
                                    alert(`The date for this listing (${item.date}) has passed. To make it Active, update its date to a future date.`);
                                    return;
                                  }
                                  if (onUpdateField) {
                                    onUpdateField(item.id, 'status', val);
                                  } else if (onToggleStatus) {
                                    onToggleStatus(item.id);
                                  }
                                }}
                                className={`appearance-none cursor-pointer pl-3 pr-6 py-0.5 rounded-full text-xs font-semibold transition-all border outline-none shadow-2xs ${
                                  item.status === 'Active'
                                    ? 'bg-[#3cb371] hover:bg-[#34a064] text-white border-[#2e9c5e]'
                                    : 'bg-[#f87171] hover:bg-[#ef5350] text-slate-900 border-[#f28b82]'
                                }`}
                                title={
                                  dateStatus.isPassed
                                    ? `Automatically Expired (Date ${item.date} has passed)`
                                    : `Automatically Active (Date ${item.date} has not passed yet)`
                                }
                              >
                                <option value="Active" className="bg-white text-slate-900">
                                  Active
                                </option>
                                <option value="Expired" className="bg-white text-slate-900">
                                  Expired
                                </option>
                              </select>
                              <ChevronDown
                                className={`w-3.5 h-3.5 absolute right-2 pointer-events-none ${
                                  item.status === 'Active' ? 'text-white' : 'text-slate-800'
                                }`}
                              />
                            </div>
                          );
                        })()}
                      </td>

                      {/* Date */}
                      <td
                        onDoubleClick={() => startEdit(item.id, 'date', item.date)}
                        className="border border-slate-300 px-2.5 py-1.5 text-center text-slate-800"
                        title="Double-click to edit inline"
                      >
                        {editingCell?.id === item.id && editingCell?.field === 'date' ? (
                          <input
                            type="text"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleKeyDown}
                            className="w-full text-xs p-1 border border-indigo-500 rounded bg-white text-center font-mono"
                          />
                        ) : (
                          (() => {
                            const dateStatus = getDateStatusInfo(item.date);
                            const hasDate = item.date && item.date.trim() !== '-' && item.date.trim() !== '';
                            return (
                              <div
                                className="inline-flex items-center justify-center gap-1 cursor-pointer"
                                title={
                                  dateStatus.isPassed
                                    ? `Date has passed (${dateStatus.badgeLabel}) • Status is Expired (Double-click to edit)`
                                    : `Active milestone (${dateStatus.badgeLabel}) • Status is Active (Double-click to edit)`
                                }
                              >
                                <span className={dateStatus.isPassed ? 'text-rose-700 font-medium' : 'text-slate-800'}>
                                  {item.date}
                                </span>
                                {hasDate && (
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      dateStatus.isPassed ? 'bg-rose-500' : 'bg-emerald-500'
                                    }`}
                                    title={dateStatus.badgeLabel}
                                  />
                                )}
                              </div>
                            );
                          })()
                        )}
                      </td>

                      {/* Renew Status (Dropdown Pill matching the design with orange styling for Want to be renew) */}
                      <td className="border border-slate-300 px-2 py-1.5 text-center">
                        <div className="inline-flex items-center justify-center relative">
                          <select
                            value={item.renewStatus}
                            onChange={(e) => {
                              if (onUpdateField) {
                                onUpdateField(item.id, 'renewStatus', e.target.value);
                              } else {
                                onToggleRenewStatus(item.id);
                              }
                            }}
                            className={`appearance-none cursor-pointer pl-3 pr-6 py-0.5 rounded text-xs transition-all outline-none border ${
                              item.renewStatus === 'Renewed'
                                ? 'bg-transparent text-[#27ae60] font-semibold border-transparent hover:bg-emerald-50'
                                : isWantToRenew
                                ? 'bg-[#ea580c] text-white font-semibold border-[#c2410c] hover:bg-[#c2410c] shadow-2xs'
                                : 'bg-[#e2e8f0] text-slate-800 font-normal border-slate-300 hover:bg-[#d8e0e8]'
                            }`}
                            title="Click to change renewal status"
                          >
                            <option value="Renewed" className="bg-white text-[#27ae60] font-semibold">
                              Renewed
                            </option>
                            <option value="Want to be renew" className="bg-white text-orange-600 font-semibold">
                              Want to be renew
                            </option>
                            <option value="Not Renewed" className="bg-white text-slate-800 font-normal">
                              Not Renewed
                            </option>
                          </select>
                          <ChevronDown
                            className={`w-3.5 h-3.5 absolute right-1.5 pointer-events-none ${
                              item.renewStatus === 'Renewed'
                                ? 'text-[#27ae60]'
                                : isWantToRenew
                                ? 'text-white'
                                : 'text-slate-600'
                            }`}
                          />
                        </div>
                      </td>

                      {/* Updated By & When with audit log trigger */}
                      <td className="border border-slate-300 px-2.5 py-1 text-left">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-semibold text-slate-800 truncate flex items-center gap-1">
                              <User className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              {item.updatedByName || 'Team Member'}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate">
                              {item.lastUpdatedAt
                                ? (() => {
                                    try {
                                      const d = new Date(item.lastUpdatedAt);
                                      return d.toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      });
                                    } catch {
                                      return item.lastUpdatedAt;
                                    }
                                  })()
                                : 'Initial'}
                            </span>
                          </div>
                          {onOpenAuditLog && (
                            <button
                              onClick={() => onOpenAuditLog(item.id, item.property)}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 transition shrink-0"
                              title="View change history for this listing"
                            >
                              <History className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Edit Row Action */}
                      <td className="border border-slate-300 px-1.5 py-1 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEditListing(item)}
                            className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-white/60 transition-colors cursor-pointer"
                            title="Edit Listing in form modal"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteListing(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-white/60 transition-colors cursor-pointer"
                            title="Delete Listing"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
