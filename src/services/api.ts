import { PropertyListing, ListingAuditEntry } from '../types';

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
export async function fetchListingsFromCloudSql(token?: string | null): Promise<PropertyListing[]> {
  try {
    const res = await fetch('/api/listings', {
      headers: getHeaders(token),
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Please sign in again.');
    }
    if (!res.ok) {
      throw new Error('Unable to load listings. Please try again.');
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Unable to load listings. Please refresh and try again.');
    }
    const json = await res.json();
    if (json && Array.isArray(json.data)) {
      return json.data;
    }
    throw new Error('Unable to load listings. Please refresh and try again.');
  } catch (error) {
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
      const failure=await res.json().catch(()=>({})); throw new Error(failure.error || 'Unable to save changes. Please try again.');
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
  userName?: string,
  version?: number
): Promise<void> {
  try {
    const res = await fetch(`/api/listings/${id}`, {
      method: 'DELETE',
      headers: getHeaders(token, userName),
      body: JSON.stringify({version}),
    });
    if (!res.ok) {
      const failure=await res.json().catch(()=>({})); throw new Error(failure.error || 'Unable to archive property.');
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
    throw error;
  }
}


export async function fetchArchivedListings():Promise<PropertyListing[]> {
 const response=await fetch('/api/listings?archived=true');const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to load archive.');return result.data;
}
export async function restoreListing(id:number,version?:number):Promise<PropertyListing> {
 const response=await fetch('/api/listings/'+id+'/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to restore property.');return result.data;
}
