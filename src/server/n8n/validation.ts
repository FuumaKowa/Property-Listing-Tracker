export class IngestInputError extends Error {}

export interface N8nListing {
  source: string;
  listing_id: string;
  url: string;
  title: string;
  owner_name: string;
  phone: string;
  source_property_type: string;
  transaction_type: string | null;
  property_type: string;
  location: string | null;
  price: string;
  size: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  tenure: string | null;
  advertiser_type: string | null;
  owner_status: string | null;
  owner_score: string | null;
  owner_evidence: unknown;
  listing_date: string | null;
  discovery_channel: string | null;
  found_at: string | null;
}

const allowed = new Set(['source', 'listing_id', 'url', 'title', 'transaction_type', 'property_type', 'location', 'price', 'size', 'bedrooms', 'bathrooms', 'tenure', 'advertiser_type', 'owner_status', 'owner_score', 'owner_evidence', 'listing_date', 'discovery_channel', 'found_at', 'owner_name', 'phone']);
const fail = (message: string): never => { throw new IngestInputError(message); };

export function validateN8nListing(body: unknown): N8nListing {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Body must be a JSON object.');
  const data = body as Record<string, unknown>;
  if (Object.keys(data).some(key => !allowed.has(key))) return fail('Body contains unsupported fields.');
  const text = (key: string, max: number, required = false): string | null => {
    const value = data[key];
    if (value === undefined || value === null || value === '') {
      if (required) return fail(`${key} is required.`);
      return null;
    }
    if (typeof value !== 'string') return fail(`${key} must be a string.`);
    const result = value.trim();
    if (result.length > max) return fail(`${key} exceeds ${max} characters.`);
    if (!result) return required ? fail(`${key} is required.`) : null;
    return result;
  };
  const decimal = (key: string, digits: number, scale: number): string | null => {
    const value = data[key];
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' && typeof value !== 'number') return fail(`${key} must be a non-negative decimal.`);
    if (typeof value === 'number' && (!Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER)) return fail(`${key} must be a finite number; use a decimal string for large amounts.`);
    let result = String(value).trim();
    if (key === 'price') {
      result = result.replace(/^RM\s*/i, '');
      if (result.includes(',')) {
        if (!/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(result)) return fail('price has invalid thousands separators.');
        result = result.replace(/,/g, '');
      }
    }
    if (!new RegExp(`^\\d{1,${digits}}(?:\\.\\d{1,${scale}})?$`).test(result)) return fail(`${key} must have at most ${digits} integer digits and ${scale} decimal places, without commas or currency symbols.`);
    return result;
  };
  const source = text('source', 80, true)!.toLowerCase();
  const externalId = data.listing_id;
  const listing_id = typeof externalId === 'number'
    ? (Number.isSafeInteger(externalId) && externalId >= 0 ? String(externalId) : fail('listing_id must be a string or a non-negative safe integer.'))
    : text('listing_id', 128, true)!;
  const url = text('url', 2048, true)!;
  if (!/^[a-z0-9][a-z0-9 ._-]*$/.test(source)) return fail('source contains invalid identifier characters.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(listing_id)) return fail('listing_id contains invalid identifier characters.');
  try {
    const parsed = new URL(url);
    if (!/^https?:\/\//i.test(url) || !parsed.hostname || parsed.username || parsed.password || /[\u0000-\u001f\u007f]/.test(url)) throw new Error();
  } catch { return fail('url must be an absolute HTTP or HTTPS URL without embedded credentials.'); }

  const date = text('listing_date', 10);
  if (date && !validDate(date)) return fail('listing_date must be a valid YYYY-MM-DD date.');
  const found = text('found_at', 40);
  if (found && (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(found) || !validDate(found.slice(0, 10)) || !Number.isFinite(Date.parse(found)))) {
    return fail('found_at must be an ISO timestamp with a timezone, for example 2026-09-11T08:00:00Z.');
  }
  let bedrooms: number | null = null;
  if (data.bedrooms !== undefined && data.bedrooms !== null && data.bedrooms !== '') {
    if (!['string', 'number'].includes(typeof data.bedrooms) || !/^\d+$/.test(String(data.bedrooms).trim())) return fail('bedrooms must be a non-negative integer.');
    bedrooms = Number(data.bedrooms);
    if (!Number.isSafeInteger(bedrooms) || bedrooms > 2147483647) return fail('bedrooms is outside the supported integer range.');
  }
  let size: string | null;
  if (typeof data.size === 'number') {
    if (!Number.isFinite(data.size) || data.size < 0 || data.size > Number.MAX_SAFE_INTEGER) return fail('size must be a non-negative number or a string including units.');
    size = String(data.size);
  } else size = text('size', 100);
  const evidence = data.owner_evidence ?? null;
  try { if (new TextEncoder().encode(JSON.stringify(evidence)).byteLength > 16384) return fail('owner_evidence exceeds 16 KiB.'); }
  catch (error) { if (error instanceof IngestInputError) throw error; return fail('owner_evidence must be JSON-serializable.'); }

  const originalType = text('property_type', 80, true)!;
  const price = decimal('price', 16, 2);
  if (price === null) return fail('price is required.');
  return {
    source, listing_id, url,
    title: text('title', 300, true)!, transaction_type: text('transaction_type', 40), property_type: normalizePropertyType(originalType),
    source_property_type: originalType,
    owner_name: text('owner_name', 200) ?? 'Not captured', phone: text('phone', 50) ?? 'Not captured',
    location: text('location', 300), price, size, bedrooms,
    bathrooms: decimal('bathrooms', 6, 2), tenure: text('tenure', 80), advertiser_type: text('advertiser_type', 80),
    owner_status: text('owner_status', 80), owner_score: decimal('owner_score', 6, 4), owner_evidence: evidence,
    listing_date: date, discovery_channel: text('discovery_channel', 120), found_at: found ? new Date(found).toISOString() : null,
  };
}

export function normalizePropertyType(value: string): string {
  const key = value.trim().toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ');
  const groups: Record<string, string[]> = {
    highrise: ['highrise', 'condominium', 'condo', 'apartment', 'flat', 'serviced residence', 'service residence'],
    landed: ['landed', 'terraced house', 'terrace house', 'semi detached house', 'semi detached', 'semi d', 'bungalow', 'townhouse', 'cluster house'],
    land: ['residential land', 'agricultural land', 'land'],
    commercial: ['shop', 'shoplot', 'office', 'factory', 'warehouse', 'industrial', 'commercial'],
  };
  for (const [category, aliases] of Object.entries(groups)) if (aliases.includes(key)) return category;
  return fail('property_type cannot be safely classified as landed, highrise, land, or commercial.');
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
