import { OwnerListing, OwnerListingInput } from '../ownerListing';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/owner-listings${path}`, {
    ...options, headers: { 'Content-Type': 'application/json' },
  });
  let body;
  try { body = await response.json(); }
  catch { throw new Error('Unable to access owner listings. Please try again.'); }
  if (!response.ok) throw new Error(body.error || 'Unable to save owner listing.');
  return body.data as T;
}

export const fetchOwnerListings = () => request<OwnerListing[]>('');
export const saveOwnerListing = (input: OwnerListingInput, id?: number) => request<OwnerListing>(id === undefined ? '' : `/${id}`, {
  method: id === undefined ? 'POST' : 'PATCH', body: JSON.stringify(input),
});
export const deleteOwnerListing = (id: number) => request<void>(`/${id}`, { method: 'DELETE' });
