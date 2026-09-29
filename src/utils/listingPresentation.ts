import { PublicationValidationError } from '../publications';

export function creatorLabel(listing: { createdByName?: string | null }) {
  return listing.createdByName?.trim() || 'Creator not recorded';
}

export function renewalRowClass(status: string) {
  if (status === 'Renewed') return 'bg-emerald-50';
  if (status === 'Want to be renew') return 'bg-orange-50';
  return 'bg-white';
}

export function validatePriority(body: object): { isPriority?: boolean } {
  if (!('isPriority' in body)) return {};
  if (typeof body.isPriority !== 'boolean') throw new PublicationValidationError('Priority must be true or false.');
  return { isPriority: body.isPriority };
}
