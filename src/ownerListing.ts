export const OWNER_SHEET = 'Master Listing Owner' as const;
export const OWNER_PROPERTY_TYPES = ['landed', 'highrise', 'land', 'commercial'] as const;
export const OWNER_STATUSES = ['Listed', 'Unlisted'] as const;

export interface OwnerListingInput {
  ownerName: string;
  noTel: string;
  propertyName: string;
  propertyLink?: string;
  propertyType: typeof OWNER_PROPERTY_TYPES[number];
  propertyPrice: string;
  status: typeof OWNER_STATUSES[number];
}

export interface OwnerListing extends OwnerListingInput {
  id: number;
}

export function safePropertyLink(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const link = value.trim();
  if (link.length > 2048 || !/^https?:\/\//i.test(link)) return null;
  try {
    const url = new URL(link);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password ? link : null;
  } catch { return null; }
}

// Shared by the form and both API runtimes; prices remain decimal strings.
export function validateOwnerListing(value: unknown): OwnerListingInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid owner listing.');
  const input = value as Record<string, unknown>;
  const text = (key: string, label: string, max: number) => {
    if (typeof input[key] !== 'string' || !input[key].trim()) throw new Error(`${label} is required.`);
    const result = input[key].trim();
    if (result.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
    return result;
  };
  const ownerName = text('ownerName', 'Owner name', 200);
  const noTel = text('noTel', 'Phone number', 50);
  const propertyName = text('propertyName', 'Property name', 300);
  let propertyLink: string | undefined;
  if (input.propertyLink !== undefined) {
    if (typeof input.propertyLink !== 'string') throw new Error('Property link must be a website URL.');
    propertyLink = input.propertyLink.trim();
    if (propertyLink && !safePropertyLink(propertyLink)) throw new Error('Enter a valid property link starting with https:// or http://.');
  }
  if (!OWNER_PROPERTY_TYPES.includes(input.propertyType as OwnerListingInput['propertyType'])) throw new Error('Select a valid property type.');
  if (!OWNER_STATUSES.includes(input.status as OwnerListingInput['status'])) throw new Error('Select Listed or Unlisted.');
  const propertyPrice = text('propertyPrice', 'Property price', 19);
  if (!/^\d{1,16}(\.\d{1,2})?$/.test(propertyPrice)) throw new Error('Property price must be a non-negative amount with up to 16 digits and 2 decimal places.');
  return { ownerName, noTel, propertyName, propertyLink, propertyPrice, propertyType: input.propertyType as OwnerListingInput['propertyType'], status: input.status as OwnerListingInput['status'] };
}
