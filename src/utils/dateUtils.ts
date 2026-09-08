import { PropertyListing } from '../types';

/**
 * Parses various date formats commonly used in real estate trackers:
 * - "DD.MM" (e.g. "23.10", "28.8", "18.8", "24.8")
 * - "DD/MM" or "DD-MM"
 * - "DD.MM.YYYY" or "DD/MM/YYYY" or "DD-MM-YYYY" (e.g. "23.10.2026")
 * - "YYYY-MM-DD" (ISO format from HTML date inputs)
 * 
 * Returns a Date object set to the very end of that day (23:59:59.999) for accurate comparison.
 */
export function parseListingDate(dateStr: string, referenceDate: Date = new Date()): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'N/A') return null;

  // Format 1: ISO YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    if (!isValidDate(year, month, day)) return null;
    return new Date(year, month, day, 23, 59, 59, 999);
  }

  // Format 2: Full DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const fullDmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (fullDmyMatch) {
    const day = parseInt(fullDmyMatch[1], 10);
    const month = parseInt(fullDmyMatch[2], 10) - 1;
    let year = parseInt(fullDmyMatch[3], 10);
    if (year < 100) year += 2000;
    if (!isValidDate(year, month, day)) return null;
    return new Date(year, month, day, 23, 59, 59, 999);
  }

  // Format 3: DD.MM or DD/MM or DD-MM (e.g. "23.10", "28.8", "18.8")
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const currentYear = referenceDate.getFullYear();
    if (!isValidDate(currentYear, month, day)) return null;
    return new Date(currentYear, month, day, 23, 59, 59, 999);
  }

  // Format 4: Fallback native parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    parsed.setHours(23, 59, 59, 999);
    return parsed;
  }

  return null;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 0 || month > 11) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month, day);
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
}

/**
 * Returns true if the date string represents a date that has already passed relative to referenceDate.
 */
export function isDatePassed(dateStr: string, referenceDate: Date = new Date()): boolean {
  const targetDate = parseListingDate(dateStr, referenceDate);
  if (!targetDate) return false;
  return referenceDate.getTime() > targetDate.getTime();
}

/**
 * Returns comprehensive status information about a listing's date.
 */
export interface DateStatusInfo {
  parsedDate: Date | null;
  isPassed: boolean;
  isToday: boolean;
  daysDiff: number;
  formattedDisplay: string;
  badgeLabel: string;
  badgeColorClass: string;
}

export function getDateStatusInfo(dateStr: string, referenceDate: Date = new Date()): DateStatusInfo {
  const targetDate = parseListingDate(dateStr, referenceDate);
  if (!targetDate) {
    return {
      parsedDate: null,
      isPassed: false,
      isToday: false,
      daysDiff: 0,
      formattedDisplay: dateStr || '-',
      badgeLabel: 'No Date',
      badgeColorClass: 'text-slate-400 bg-slate-50',
    };
  }

  const startOfRefDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()).getTime();
  const startOfTargetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
  
  const msInDay = 1000 * 60 * 60 * 24;
  const daysDiff = Math.round((startOfTargetDay - startOfRefDay) / msInDay);

  const isToday = daysDiff === 0;
  const isPassed = referenceDate.getTime() > targetDate.getTime();

  let badgeLabel = '';
  let badgeColorClass = '';

  if (isPassed) {
    const passedDays = Math.abs(daysDiff);
    badgeLabel = passedDays === 0 ? 'Expired today' : `Expired ${passedDays}d ago`;
    badgeColorClass = 'text-rose-700 bg-rose-50 border-rose-200';
  } else if (isToday) {
    badgeLabel = 'Expires today';
    badgeColorClass = 'text-amber-700 bg-amber-50 border-amber-200';
  } else {
    badgeLabel = daysDiff === 1 ? '1 day left' : `${daysDiff} days left`;
    badgeColorClass = daysDiff <= 7 
      ? 'text-amber-600 bg-amber-50 border-amber-200' 
      : 'text-emerald-700 bg-emerald-50 border-emerald-200';
  }

  return {
    parsedDate: targetDate,
    isPassed,
    isToday,
    daysDiff,
    formattedDisplay: dateStr,
    badgeLabel,
    badgeColorClass,
  };
}

/**
 * Automatically checks all listings against the current date.
 * - If the listing date has passed the current date, automatically sets status to 'Expired'.
 * - If the listing date has NOT passed yet (today or in the future), automatically sets status to 'Active'.
 */
export function autoExpireListings(
  listings: PropertyListing[],
  referenceDate: Date = new Date()
): {
  updatedListings: PropertyListing[];
  expiredCount: number;
  expiredIds: number[];
  activatedCount: number;
  activatedIds: number[];
  changedCount: number;
} {
  const expiredIds: number[] = [];
  const activatedIds: number[] = [];

  const updatedListings = listings.map((listing) => {
    if (listing.date && listing.date.trim() !== '-' && listing.date.trim() !== '' && listing.date.trim() !== 'N/A') {
      const isPassed = isDatePassed(listing.date, referenceDate);
      const targetStatus: 'Active' | 'Expired' = isPassed ? 'Expired' : 'Active';

      const targetRenewStatus = isPassed ? 'Not Renewed' : listing.renewStatus;

      if (listing.status !== targetStatus || listing.renewStatus !== targetRenewStatus) {
        if (targetStatus === 'Expired') {
          expiredIds.push(listing.id);
        } else {
          activatedIds.push(listing.id);
        }
        return {
          ...listing,
          status: targetStatus,
          renewStatus: targetRenewStatus,
        };
      }
    }
    return listing;
  });

  return {
    updatedListings,
    expiredCount: expiredIds.length,
    expiredIds,
    activatedCount: activatedIds.length,
    activatedIds,
    changedCount: expiredIds.length + activatedIds.length,
  };
}

export const autoSyncListingsByDate = autoExpireListings;

/**
 * Checks a single listing and returns an updated copy:
 * - status = 'Expired' if date has passed
 * - status = 'Active' if date has not passed yet
 */
export function evaluateListingExpiry(
  listing: PropertyListing,
  referenceDate: Date = new Date()
): PropertyListing {
  if (listing.date && listing.date.trim() !== '-' && listing.date.trim() !== '' && listing.date.trim() !== 'N/A') {
    const isPassed = isDatePassed(listing.date, referenceDate);
    return {
      ...listing,
      status: isPassed ? 'Expired' : 'Active',
      renewStatus: isPassed ? 'Not Renewed' : listing.renewStatus,
    };
  }
  return listing;
}
