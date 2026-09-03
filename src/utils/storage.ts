import { PropertyListing } from '../types';
import { INITIAL_PROPERTY_LISTINGS } from '../data/initialData';
import { autoExpireListings } from './dateUtils';

const STORAGE_KEY = 'property_listing_tracker_data_v2';

export function loadListings(): PropertyListing[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const { updatedListings } = autoExpireListings(parsed);
        return updatedListings;
      }
    }
  } catch (e) {
    console.error('Failed to load listings from storage', e);
  }
  const { updatedListings } = autoExpireListings(INITIAL_PROPERTY_LISTINGS);
  return updatedListings;
}

export function saveListings(listings: PropertyListing[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
  } catch (e) {
    console.error('Failed to save listings to storage', e);
  }
}

export function resetListings(): PropertyListing[] {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // ignore
  }
  const { updatedListings } = autoExpireListings(INITIAL_PROPERTY_LISTINGS);
  return updatedListings;
}

export function exportToCSV(listings: PropertyListing[]): void {
  const headers = ['No.', 'Property', 'Project Category', 'Location', 'Tenure', 'PM', 'Available Units', 'Status', 'Date', 'Renew Status'];
  const rows = listings.map((l) => [
    l.id,
    `"${(l.property || '').replace(/"/g, '""')}"`,
    `"${(l.projectCategory || 'Project Marketing (PM)').replace(/"/g, '""')}"`,
    `"${(l.location || '').replace(/"/g, '""')}"`,
    `"${(l.tenure || '').replace(/"/g, '""')}"`,
    `"${(l.pm || '').replace(/"/g, '""')}"`,
    `"${(l.availableUnits || '').replace(/"/g, '""')}"`,
    `"${l.status}"`,
    `"${l.date}"`,
    `"${l.renewStatus}"`,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Property_Listing_Tracker_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function parseCSVToListings(csvText: string, startingId: number): PropertyListing[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const results: PropertyListing[] = [];
  let currentId = startingId;

  // Simple CSV parser supporting quotes
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cells: string[] = [];
    let inQuotes = false;
    let currentCell = '';

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim());

    if (cells.length >= 8) {
      let prop = cells[1] || `Property ${currentId}`;
      let cat: any = 'Project Marketing (PM)';
      let loc = '-';
      let ten = '-';
      let pmVal = '-';
      let units = '-';
      let stat: any = 'Active';
      let pDate = '';
      let rStat: any = 'Not Renewed';

      // 10-column format with Category
      if (cells.length >= 10) {
        cat = cells[2] || 'Project Marketing (PM)';
        loc = cells[3] || '-';
        ten = cells[4] || '-';
        pmVal = cells[5] || '-';
        units = cells[6] || '-';
        stat = cells[7] === 'Expired' ? 'Expired' : 'Active';
        pDate = cells[8] || `${new Date().getDate()}.${new Date().getMonth() + 1}`;
        rStat = cells[9]?.includes('Want') ? 'Want to be renew' : cells[9] === 'Renewed' ? 'Renewed' : 'Not Renewed';
      } else {
        // Legacy 9-column format
        loc = cells[2] || '-';
        ten = cells[3] || '-';
        pmVal = cells[4] || '-';
        units = cells[5] || '-';
        stat = cells[6] === 'Expired' ? 'Expired' : 'Active';
        pDate = cells[7] || `${new Date().getDate()}.${new Date().getMonth() + 1}`;
        rStat = cells[8]?.includes('Want') ? 'Want to be renew' : cells[8] === 'Renewed' ? 'Renewed' : 'Not Renewed';
      }

      const initialItem: PropertyListing = {
        id: currentId++,
        property: prop,
        projectCategory: cat,
        location: loc,
        tenure: ten,
        pm: pmVal,
        availableUnits: units,
        status: stat,
        date: pDate,
        renewStatus: rStat,
      };

      results.push(initialItem);
    }
  }

  const { updatedListings } = autoExpireListings(results);
  return updatedListings;
}
