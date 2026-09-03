import { ExtractionResult, PropertyListing, PMAlertDraft, StandardizationResult, ListingAuditEntry } from '../types';

// Helper to build headers including Auth token and user attribution
function getHeaders(token?: string | null, userName?: string, userEmail?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (userName) {
    headers['x-user-name'] = userName;
  }
  if (userEmail) {
    headers['x-user-email'] = userEmail;
  }
  return headers;
}

// 1. Fetch all listings from Cloud SQL
export async function fetchListingsFromCloudSql(): Promise<PropertyListing[]> {
  try {
    const res = await fetch('/api/listings');
    if (!res.ok) {
      throw new Error(`Failed to fetch listings: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error('fetchListingsFromCloudSql error:', error);
    throw error;
  }
}

// 2. Create listing in Cloud SQL with audit user name and date
export async function createListingInCloudSql(
  listing: Omit<PropertyListing, 'id'>,
  token?: string | null,
  userName?: string,
  userEmail?: string
): Promise<PropertyListing> {
  try {
    const res = await fetch('/api/listings', {
      method: 'POST',
      headers: getHeaders(token, userName, userEmail),
      body: JSON.stringify({
        ...listing,
        updatedByName: userName || 'Team Member',
        updatedByEmail: userEmail,
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create listing: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  } catch (error) {
    console.error('createListingInCloudSql error:', error);
    throw error;
  }
}

// 3. Update listing in Cloud SQL with audit user name and date
export async function updateListingInCloudSql(
  id: number,
  updates: Partial<PropertyListing>,
  token?: string | null,
  userName?: string,
  userEmail?: string
): Promise<PropertyListing> {
  try {
    const res = await fetch(`/api/listings/${id}`, {
      method: 'PATCH',
      headers: getHeaders(token, userName, userEmail),
      body: JSON.stringify({
        ...updates,
        updatedByName: userName || 'Team Member',
        updatedByEmail: userEmail,
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to update listing: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  } catch (error) {
    console.error('updateListingInCloudSql error:', error);
    throw error;
  }
}

// 4. Delete listing from Cloud SQL
export async function deleteListingFromCloudSql(
  id: number,
  token?: string | null,
  userName?: string
): Promise<void> {
  try {
    const res = await fetch(`/api/listings/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token, userName),
    });
    if (!res.ok) {
      throw new Error(`Failed to delete listing: ${res.statusText}`);
    }
  } catch (error) {
    console.error('deleteListingFromCloudSql error:', error);
    throw error;
  }
}

// 5. Fetch audit logs (who updated which listing and when)
export async function fetchAuditLogs(listingId?: number): Promise<ListingAuditEntry[]> {
  try {
    const url = listingId ? `/api/audit-logs?listingId=${listingId}` : '/api/audit-logs';
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch audit logs: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error('fetchAuditLogs error:', error);
    return [];
  }
}

// ==========================================
// AI Features
// ==========================================

export async function extractListingsWithAI(text: string): Promise<{ success: boolean; data: ExtractionResult[]; note?: string }> {
  try {
    const res = await fetch('/api/gemini/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      throw new Error(`Server error: ${res.statusText}`);
    }
    return await res.json();
  } catch (error: any) {
    console.error('Extract API error:', error);
    throw error;
  }
}

export async function sendChatMessage(
  message: string,
  history: any[],
  tableData: PropertyListing[]
): Promise<{ success: boolean; reply: string; sources?: string[]; suggestedActions?: any[]; note?: string }> {
  try {
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, tableData }),
    });
    if (!res.ok) {
      throw new Error(`Server error: ${res.statusText}`);
    }
    return await res.json();
  } catch (error: any) {
    console.error('Chat API error:', error);
    throw error;
  }
}

export async function generatePMAlertDraft(listing: PropertyListing): Promise<{ success: boolean; draft: PMAlertDraft }> {
  try {
    const res = await fetch('/api/gemini/generate-pm-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing }),
    });
    if (!res.ok) {
      throw new Error(`Server error: ${res.statusText}`);
    }
    return await res.json();
  } catch (error: any) {
    console.error('PM Alert API error:', error);
    throw error;
  }
}

export async function standardizeListings(listings: PropertyListing[]): Promise<{ success: boolean; results: StandardizationResult[] }> {
  try {
    const res = await fetch('/api/gemini/standardize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listings }),
    });
    if (!res.ok) {
      throw new Error(`Server error: ${res.statusText}`);
    }
    return await res.json();
  } catch (error: any) {
    console.error('Standardize API error:', error);
    throw error;
  }
}
