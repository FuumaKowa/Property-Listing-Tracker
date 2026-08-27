export type TenureType = 'Freehold' | 'Leasehold' | 'Freehold Malay Reserved' | '-' | string;
export type ListingStatus = 'Active' | 'Expired' | 'Pending' | 'Sold Out';
export type RenewStatus = 'Renewed' | 'Not Renewed' | 'Want to be renew' | 'In Progress' | '-';

export interface PropertyListing {
  id: number;
  property: string;
  location: string;
  tenure: TenureType;
  pm: string;
  availableUnits: string;
  status: ListingStatus;
  date: string;
  renewStatus: RenewStatus;
  notes?: string;
  updatedAt?: string;
}

export interface ExtractionResult {
  property: string;
  location: string;
  tenure: string;
  pm: string;
  availableUnits: string;
  status: ListingStatus;
  date: string;
  renewStatus: RenewStatus;
  confidenceNotes?: string;
}

export interface StandardizationResult {
  id: number;
  originalLocation: string;
  standardizedLocation: string;
  originalTenure: string;
  standardizedTenure: string;
  suggestedChanges: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: string[];
  suggestedActions?: {
    label: string;
    actionType: 'filter_pm' | 'filter_status' | 'filter_location' | 'inspect_id';
    value: string | number;
  }[];
}

export interface PMAlertDraft {
  id: string;
  listingId: number;
  propertyName: string;
  pm: string;
  location: string;
  daysExpiredOrDate: string;
  urgency: 'High' | 'Medium' | 'Low';
  emailSubject: string;
  emailBody: string;
  whatsappMessage: string;
  slackMessage: string;
}

export interface FilterState {
  searchQuery: string;
  status: string;
  renewStatus: string;
  tenure: string;
  pm: string;
  location: string;
  sortBy: keyof PropertyListing;
  sortOrder: 'asc' | 'desc';
}
