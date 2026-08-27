import React, { useState, useEffect } from 'react';
import { PropertyListing, TenureType, ListingStatus, RenewStatus } from '../../types';
import { Building2, X, Check, Calendar, MapPin, User, Layers, Shield } from 'lucide-react';

interface ListingFormModalProps {
  isOpen: boolean;
  listingToEdit: PropertyListing | null;
  onClose: () => void;
  onSave: (listing: PropertyListing) => void;
  nextId: number;
}

export const ListingFormModal: React.FC<ListingFormModalProps> = ({
  isOpen,
  listingToEdit,
  onClose,
  onSave,
  nextId,
}) => {
  const [formData, setFormData] = useState<Partial<PropertyListing>>({
    property: '',
    location: '',
    tenure: 'Freehold',
    pm: '',
    availableUnits: '',
    status: 'Active',
    date: `${new Date().getDate()}.${new Date().getMonth() + 1}`,
    renewStatus: 'Renewed',
  });

  useEffect(() => {
    if (listingToEdit) {
      setFormData(listingToEdit);
    } else {
      const now = new Date();
      setFormData({
        id: nextId,
        property: '',
        location: '',
        tenure: 'Freehold',
        pm: '',
        availableUnits: '',
        status: 'Active',
        date: `${now.getDate()}.${now.getMonth() + 1}`,
        renewStatus: 'Renewed',
      });
    }
  }, [listingToEdit, nextId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.property?.trim()) {
      alert('Property / Project name is required.');
      return;
    }

    const payload: PropertyListing = {
      id: formData.id || nextId,
      property: formData.property.trim(),
      location: formData.location?.trim() || '-',
      tenure: formData.tenure || '-',
      pm: formData.pm?.trim() || '-',
      availableUnits: formData.availableUnits?.trim() || '-',
      status: (formData.status as ListingStatus) || 'Active',
      date: formData.date?.trim() || `${new Date().getDate()}.${new Date().getMonth() + 1}`,
      renewStatus: (formData.renewStatus as RenewStatus) || 'Not Renewed',
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
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
                  : `Assigning Record #${String(nextId).padStart(3, '0')}`}
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
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
          {/* Property Name */}
          <div className="flex flex-col gap-1">
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

          {/* Location & PM */}
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

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                Assigned PM / Team
              </label>
              <input
                type="text"
                value={formData.pm || ''}
                onChange={(e) => setFormData({ ...formData, pm: e.target.value })}
                placeholder="e.g. Benik or Akram/Benik/Fb"
                className="text-xs p-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-indigo-700 font-medium"
              />
            </div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-slate-100">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">Lifecycle Status</label>
              <select
                value={formData.status || 'Active'}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as ListingStatus })
                }
                className="text-xs p-2 border border-slate-300 rounded-lg outline-none bg-white font-semibold cursor-pointer"
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
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
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

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 mt-2">
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
        </form>
      </div>
    </div>
  );
};
