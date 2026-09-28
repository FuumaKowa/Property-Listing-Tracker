export interface PublicationChannel { id: number; name: string; archivedAt: string | null }
export interface PublicationInput { channelId: number; url: string; label?: string | null; notes?: string | null }
export interface ListingPublication extends PublicationInput { id: number; listingId: number; label: string | null; notes: string | null }
export interface PublicationSummary { listingId: number; count: number; channels: string[] }
export class PublicationValidationError extends Error {}
export function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PublicationValidationError('Expected a JSON object.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, label: string, optional = false): string | null {
  if (optional && (value == null || value === '')) return null;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new PublicationValidationError(`${label} must contain 1–${max} characters.`);
  return value.trim();
}
export function validateChannelName(value: unknown): string { return text(value, 80, 'Channel name')!; }
export function positiveId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new PublicationValidationError('Invalid ID.');
  return value;
}
export function validatePublicationInput(value: unknown): PublicationInput {
  const body = objectInput(value);
  const url = text(body.url, 2048, 'URL')!;
  try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) throw new Error(); }
  catch { throw new PublicationValidationError('Use a valid http or https URL without credentials.'); }
  return { channelId: positiveId(body.channelId), url, label: text(body.label, 120, 'Label', true), notes: text(body.notes, 4000, 'Notes', true) };
}
export function validateRepostFields(value: unknown): { propertyGuruRepostDate?: string | null; propertyGuruRepostMode?: 'Manual' | 'Auto' | null } {
  const body = objectInput(value);
  const result: ReturnType<typeof validateRepostFields> = {};
  if ('propertyGuruRepostDate' in body) {
    const date = body.propertyGuruRepostDate;
    if (date != null && date !== '' && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new PublicationValidationError('Invalid repost date.');
    result.propertyGuruRepostDate = date ? date as string : null;
  }
  if ('propertyGuruRepostMode' in body) {
    const mode = body.propertyGuruRepostMode;
    if (mode != null && mode !== '' && mode !== 'Manual' && mode !== 'Auto') throw new PublicationValidationError('Invalid repost mode.');
    result.propertyGuruRepostMode = mode ? mode as 'Manual' | 'Auto' : null;
  }
  return result;
}
