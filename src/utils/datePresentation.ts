import { parseListingDate } from './dateUtils';

const pad = (value: number | string) => String(value).padStart(2, '0');
function calendarParts(value: string): {day: string; month: string; year?: string} | null {
  const full = /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})$/;
  if (full.test(value)) {
    const year = /^\d{4}[-/.]/.test(value) ? value.split(/[-/.]/)[0] : value.split(/[-/.]/)[2];
    if (year.length > 2 && Number(year) < 1000) return null;
    const parsed = parseListingDate(value);
    return parsed ? {day:pad(parsed.getDate()),month:pad(parsed.getMonth()+1),year:String(parsed.getFullYear())} : null;
  }
  const partial = /^(\d{1,2})[-/.](\d{1,2})$/.exec(value);
  if (partial && parseListingDate(`${partial[1]}/${partial[2]}/2000`)) return {day:pad(partial[1]),month:pad(partial[2])};
  return null;
}

export function dateInputValue(value?: string | null): string {
  if (!value) return '';
  const parts = calendarParts(value.trim());
  return parts ? `${parts.day}/${parts.month}${parts.year ? '/'+parts.year : ''}` : value;
}
export function formatCalendarDate(value?: string | null, fallback = '—'): string {
  if (!value) return fallback;
  const parts = calendarParts(value.trim());
  return parts ? `${parts.day}/${parts.month}${parts.year ? '/'+parts.year : ' (year not recorded)'}` : value;
}

// Compare the displayed draft first, so an unrelated edit never rewrites legacy data.
export function normalizeDateEdit(draft: string, original?: string | null): string {
  if (draft === dateInputValue(original)) return original || '';
  const value = draft.trim();
  if (!value) return '';
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) throw new Error('Enter dates as DD/MM/YYYY, for example 30/09/2026.');
  const parts = calendarParts(value);
  if (!parts?.year) throw new Error('Enter a valid calendar date in DD/MM/YYYY format.');
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${pad(date.getDate())}/${pad(date.getMonth()+1)}/${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function formatAuditValue(key: string, value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') {
    if (['date','property_guru_repost_date','propertyGuruRepostDate','listing_date','listingDate'].includes(key)) return formatCalendarDate(value);
    if (['archived_at','archivedAt','found_at','foundAt'].includes(key)) return formatDateTime(value);
  }
  return String(value);
}
