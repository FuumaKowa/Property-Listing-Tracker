import { PropertyListing } from '../types';
import { INITIAL_PROPERTY_LISTINGS } from '../data/initialData';
import { validateRepostFields } from '../publications';
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
  const headers = ['No.', 'Property', 'Project Category', 'Location', 'Tenure', 'PM', 'Available Units', 'Status', 'Date', 'Renew Status', 'Negotiator', 'Agent', 'No Tel', 'Notes', 'PropertyGuru Repost Date', 'PropertyGuru Repost Mode'];
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
    ...[l.negotiator,l.agent,l.noTel,l.notes,l.propertyGuruRepostDate,l.propertyGuruRepostMode].map(value => `"${String(value || '').replace(/"/g, '""')}"`),
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
  const rows: string[][] = []; let row: string[] = [], value = '', quoted = false;
  for (let i=0;i<csvText.length;i++) {
    const c=csvText[i];
    if(c==='"') { if(quoted&&csvText[i+1]==='"'){value+='"';i++;}else quoted=!quoted; }
    else if(c===','&&!quoted){row.push(value.trim());value='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&csvText[i+1]==='\n')i++;row.push(value.trim());if(row.some(Boolean))rows.push(row);row=[];value='';}
    else value+=c;
  }
  row.push(value.trim());if(row.some(Boolean))rows.push(row);
  if(rows.length<2)return [];
  const hasCategory=rows[0].some(value=>/^(project|property) category$/i.test(value));
  const results:PropertyListing[]=[];
  for(const cells of rows.slice(1)){
    if(cells.length<8)continue;
    const shift=hasCategory?1:0;
    const rawStatus=cells[6+shift];
    const rawRenew=cells[8+shift];
    let repost:ReturnType<typeof validateRepostFields>={};
    if(hasCategory&&cells.length>=16){try{repost=validateRepostFields({propertyGuruRepostDate:cells[14],propertyGuruRepostMode:cells[15]});}catch{throw new Error('CSV contains an invalid repost date or mode.');}}
    results.push({id:startingId++,property:cells[1]||'Unnamed property',projectCategory:hasCategory?(cells[2] as PropertyListing['projectCategory']):'Project Marketing (PM)',location:cells[2+shift]||'-',tenure:cells[3+shift]||'-',pm:cells[4+shift]||'-',availableUnits:cells[5+shift]||'-',status:rawStatus==='Sold'||rawStatus==='Sold Out'?'Sold Out':rawStatus==='Pending'?'Pending':rawStatus==='Expired'?'Expired':'Active',date:cells[7+shift]||'',renewStatus:['Renewed','Not Renewed','Want to be renew','In Progress','-'].includes(rawRenew)?rawRenew as PropertyListing['renewStatus']:'Not Renewed',...(hasCategory&&cells.length>=14?{negotiator:cells[10],agent:cells[11],noTel:cells[12],notes:cells[13]}:{}),...repost});
  }
  return autoExpireListings(results).updatedListings;
}
