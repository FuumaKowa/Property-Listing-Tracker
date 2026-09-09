import React, { useState, useEffect } from 'react';
import { PropertyListing, TenureType, ListingStatus, RenewStatus, ProjectCategory, PROJECT_CATEGORIES } from '../../types';
import { Building2, X, Check, Calendar, MapPin, User, Layers, Shield, Clock, AlertTriangle, UserCheck, Tag } from 'lucide-react';
import { getDateStatusInfo, isDatePassed } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';

interface ListingFormModalProps {
  isOpen: boolean;
  listingToEdit: PropertyListing | null;
  onClose: () => void;
  onSave: (listing: PropertyListing) => void;
  nextId: number;
  displayNumber?: number;
  defaultProjectCategory?: ProjectCategory;
}

export const ListingFormModal: React.FC<ListingFormModalProps> = ({
  isOpen,
  listingToEdit,
  onClose,
  onSave,
  nextId,
  displayNumber = nextId,
  defaultProjectCategory = 'Project Marketing (PM)',
}) => {
  const { user } = useAuth();
  const userName = user?.displayName || user?.username || 'Team Member';
  const [formData, setFormData] = useState<Partial<PropertyListing>>({
    property: '',
    projectCategory: defaultProjectCategory,
    location: '',
    tenure: 'Freehold',
    pm: '',
    availableUnits: '',
    status: 'Active',
    date: `${new Date().getDate()}.${new Date().getMonth() + 1}`,
    renewStatus: 'Renewed',
  });
  const usesNegotiatorLabel = formData.projectCategory === 'Rental' || formData.projectCategory === 'Subsale CoA (SSCOA)';

  useEffect(() => {
    if (listingToEdit) {
      const hasDate = listingToEdit.date && listingToEdit.date.trim() !== '-' && listingToEdit.date.trim() !== '';
      const isPassed = hasDate ? isDatePassed(listingToEdit.date) : false;
      setFormData({
        ...listingToEdit,
        projectCategory: listingToEdit.projectCategory || 'Project Marketing (PM)',
        status: hasDate ? (isPassed ? 'Expired' : 'Active') : listingToEdit.status,
      });
    } else {
      const now = new Date();
      const defaultDate = `${now.getDate()}.${now.getMonth() + 1}`;
      setFormData({
        id: nextId,
        property: '',
        projectCategory: defaultProjectCategory,
        location: '',
        tenure: 'Freehold',
        pm: '',
        availableUnits: '',
        status: 'Active',
        date: defaultDate,
        renewStatus: 'Renewed',
      });
    }
  }, [listingToEdit, nextId, isOpen, defaultProjectCategory]);

  if (!isOpen) return null;

  const dateStatus = getDateStatusInfo(formData.date || '');

  const handleDateChange = (newDate: string) => {
    const hasDate = newDate && newDate.trim() !== '-' && newDate.trim() !== '';
    const isPassed = hasDate ? isDatePassed(newDate) : false;
    setFormData((prev) => ({
      ...prev,
      date: newDate,
      status: hasDate ? (isPassed ? 'Expired' : 'Active') : prev.status,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.property?.trim()) {
      alert('Property / Project name is required.');
      return;
    }

    const dateStr = formData.date?.trim() || `${new Date().getDate()}.${new Date().getMonth() + 1}`;
    const hasDate = dateStr !== '-' && dateStr !== '';
    const dateHasPassed = hasDate ? isDatePassed(dateStr) : false;
    const computedStatus = hasDate ? (dateHasPassed ? 'Expired' : 'Active') : (formData.status as ListingStatus) || 'Active';

    const payload: PropertyListing = {
      id: formData.id || nextId,
      property: formData.property.trim(),
      projectCategory: (formData.projectCategory as ProjectCategory) || 'Project Marketing (PM)',
      location: formData.location?.trim() || '-',
      tenure: formData.tenure || '-',
      pm: formData.pm?.trim() || '-',
      availableUnits: formData.availableUnits?.trim() || '-',
      status: computedStatus,
      date: dateStr,
      renewStatus: (formData.renewStatus as RenewStatus) || 'Not Renewed',
      updatedByName: userName,
      updatedByEmail: undefined,
      lastUpdatedAt: new Date().toISOString(),
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="modal-panel bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 shrink-0 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">
                {listingToEdit ? 'Edit Property Listing' : 'Create New Property Listing'}
              </h2>
              <p className="text-xs text-slate-300">
                {listingToEdit
                  ? `Editing Record #${String(listingToEdit.id).padStart(3, '0')}`
                  : `Assigning Record #${String(displayNumber).padStart(3, '0')}`}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 min-h-0 flex flex-col gap-4 overflow-y-auto">
          {/* Property Name & Project Category */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">
                Property / Project Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.property || ''}
                onChange={(e) => setFormData({ ...formData, property: e.target.value })}
                placeholder="e.g. Service Apartment Linkar 52"
                className="text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 font-semibold text-slate-900"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Tag className="w-3 h-3 text-indigo-500" />
                Project Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.projectCategory || 'Project Marketing (PM)'}
                onChange={(e) => setFormData({ ...formData, projectCategory: e.target.value as ProjectCategory })}
                className="text-xs p-2.5 border border-slate-300 rounded-lg outline-none bg-white focus:border-indigo-500 font-medium text-slate-800 cursor-pointer"
              >
                {PROJECT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location & assigned contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                Location / Town
              </label>
              <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Shah Alam, Selangor"
                className="text-xs p-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
              />
            </div>

            {usesNegotiatorLabel ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1"><User className="w-3 h-3 text-slate-400" />Negotiator</label>
                  <input type="text" value={formData.negotiator || ''} onChange={(e) => setFormData({ ...formData, negotiator: e.target.value })} placeholder="Negotiator" className="text-xs p-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-indigo-700 font-medium" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Agent</label>
                  <input type="text" value={formData.agent || ''} onChange={(e) => setFormData({ ...formData, agent: e.target.value })} placeholder="Agent" className="text-xs p-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-indigo-700 font-medium" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">No Tel</label>
                  <input type="text" value={formData.noTel || ''} onChange={(e) => setFormData({ ...formData, noTel: e.target.value })} placeholder="Phone number" className="text-xs p-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-indigo-700 font-medium" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1"><User className="w-3 h-3 text-slate-400" />Assigned PM / Team</label>
                <input type="text" value={formData.pm || ''} onChange={(e) => setFormData({ ...formData, pm: e.target.value })} placeholder="e.g. Benik or Akram/Benik/Fb" className="text-xs p-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-indigo-700 font-medium" />
              </div>
            )}
          </div>

          {/* Tenure & Available Units */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Shield className="w-3 h-3 text-slate-400" />
                Land Title / Tenure
              </label>
              <select
                value={formData.tenure || 'Freehold'}
                onChange={(e) => setFormData({ ...formData, tenure: e.target.value as TenureType })}
                className="text-xs p-2 border border-slate-300 rounded-lg outline-none bg-white focus:border-indigo-500 cursor-pointer"
              >
                <option value="Freehold">Freehold</option>
                <option value="Leasehold">Leasehold</option>
                <option value="Freehold Malay Reserved">Freehold Malay Reserved (F.M.R.)</option>
                <option value="-">- (Unspecified)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-400" />
                Available Units / Stock
              </label>
              <input
                type="text"
                value={formData.availableUnits || ''}
                onChange={(e) => setFormData({ ...formData, availableUnits: e.target.value })}
                placeholder="e.g. 10/62, 784, or 70% Booking"
                className="text-xs p-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 font-mono"
              />
              <span className="text-[10px] text-slate-400">
                Supports ratios (10/62), counts (784), or percentages (70%)
              </span>
            </div>
          </div>

          {/* Status, Date, Renew Status */}
          <div className="flex flex-col gap-3 pt-1 border-t border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Lifecycle Status</span>
                  {formData.date && formData.date.trim() !== '-' && formData.date.trim() !== '' && (
                    dateStatus.isPassed ? (
                      <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        Auto-Expired
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Auto-Active
                      </span>
                    )
                  )}
                </label>
                <select
                  value={dateStatus.isPassed ? 'Expired' : formData.status || 'Active'}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as ListingStatus })
                  }
                  className="text-xs p-2 border rounded-lg outline-none font-semibold cursor-pointer bg-white text-slate-900 border-slate-300 focus:border-indigo-500"
                  title="Lifecycle status is automatically calculated based on the milestone date"
                >
                  <option value="Active">Active</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Date (DD.MM)
                </label>
                <input
                  type="text"
                  value={formData.date || ''}
                  onChange={(e) => handleDateChange(e.target.value)}
                  placeholder="e.g. 26.10"
                  className="text-xs p-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Renewal Status</label>
                <select
                  value={formData.renewStatus || 'Renewed'}
                  onChange={(e) =>
                    setFormData({ ...formData, renewStatus: e.target.value as RenewStatus })
                  }
                  className="text-xs p-2 border border-slate-300 rounded-lg outline-none bg-white font-medium cursor-pointer"
                >
                  <option value="Renewed">Renewed</option>
                  <option value="Want to be renew">Want to be renew</option>
                  <option value="Not Renewed">Not Renewed</option>
                </select>
              </div>
            </div>

            {/* Live Expiry Status Notification */}
            {formData.date && (
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
                  dateStatus.isPassed
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : dateStatus.isToday
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                {dateStatus.isPassed ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <div>
                  <span className="font-bold">
                    {dateStatus.isPassed ? 'Date has passed:' : 'Date status:'}
                  </span>{' '}
                  <span className="font-medium">
                    {dateStatus.badgeLabel}
                  </span>
                  {dateStatus.isPassed ? (
                    <span className="block text-[11px] text-rose-600 mt-0.5">
                      System automatically marks this listing as <strong>Expired</strong>. Update to a future date to re-activate.
                    </span>
                  ) : (
                    <span className="block text-[11px] text-emerald-700 mt-0.5">
                      Date has not passed yet. System automatically marks this listing as <strong>Active</strong>.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                Saving as: <strong className="text-slate-800">{userName}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{listingToEdit ? 'Save Changes' : 'Create Listing'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
