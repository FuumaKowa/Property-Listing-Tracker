export type TenureType = 'Freehold' | 'Leasehold' | 'Freehold Malay Reserved' | '-' | string;
export type ListingStatus = 'Active' | 'Expired' | 'Pending' | 'Sold Out';
export type RenewStatus = 'Renewed' | 'Not Renewed' | 'Want to be renew' | 'In Progress' | '-';

export type ProjectCategory =
  | 'Project Marketing (PM)'
  | 'Rental'
  | 'Subsale CoA (SSCOA)'
  | 'Subsale Direct Listing (SSDL)'
  | 'Million Dollar Property (MD)'
  | 'Auction';

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  'Project Marketing (PM)',
  'Rental',
  'Subsale CoA (SSCOA)',
  'Subsale Direct Listing (SSDL)',
  'Million Dollar Property (MD)',
  'Auction',
];

export interface PropertyListing {
  id: number;
  property: string;
  projectCategory?: ProjectCategory;
  location: string;
  tenure: TenureType;
  pm: string;
  negotiator?: string;
  agent?: string;
  noTel?: string;
  availableUnits: string;
  status: ListingStatus;
  date: string;
  renewStatus: RenewStatus;
  notes?: string;
  updatedAt?: string;
  // Audit tracking: user name and timestamp
  updatedByUserId?: string;
  updatedByName?: string;
  updatedByEmail?: string;
  lastUpdatedAt?: string;
}

export interface ListingAuditEntry {
  id: number;
  listingId: number;
  action: string;
  changedFields?: string;
  userName: string;
  userEmail?: string;
  userUid?: string;
  timestamp: string;
}

export interface FilterState {
  searchQuery: string;
  projectCategory?: string;
  category?: string;
  status: string;
  renewStatus: string;
  tenure: string;
  pm: string;
  location: string;
  sortBy: keyof PropertyListing;
  sortOrder: 'asc' | 'desc';
}
