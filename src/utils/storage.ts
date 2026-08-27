import { PropertyListing } from '../types';
import { INITIAL_PROPERTY_LISTINGS } from '../data/initialData';

const STORAGE_KEY = 'property_listing_tracker_data_v2';

export function loadListings(): PropertyListing[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load listings from storage', e);
  }
  return INITIAL_PROPERTY_LISTINGS;
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
  return INITIAL_PROPERTY_LISTINGS;
}

export function exportToCSV(listings: PropertyListing[]): void {
  const headers = ['No.', 'Property', 'Location', 'Tenure', 'PM', 'Available Units', 'Status', 'Date', 'Renew Status'];
  const rows = listings.map((l) => [
    l.id,
    `"${(l.property || '').replace(/"/g, '""')}"`,
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

    if (cells.length >= 7) {
      results.push({
        id: currentId++,
        property: cells[1] || `Property ${currentId}`,
        location: cells[2] || '-',
        tenure: cells[3] || '-',
        pm: cells[4] || '-',
        availableUnits: cells[5] || '-',
        status: (cells[6] === 'Expired' ? 'Expired' : 'Active') as any,
        date: cells[7] || `${new Date().getDate()}.${new Date().getMonth() + 1}`,
        renewStatus: (cells[8]?.includes('Want')
          ? 'Want to be renew'
          : cells[8] === 'Renewed'
          ? 'Renewed'
          : 'Not Renewed') as any,
      });
    }
  }

  return results;
}
