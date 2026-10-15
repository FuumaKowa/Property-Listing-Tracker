import type { SummaryChoice, SummaryPreview, SummaryReportListItem } from '../ownerSummaryReport';

async function request<T>(input?: object,offset=0): Promise<T> {
  const response = await fetch('/api/owner-listings/summary-report'+(input?'':`?offset=${offset}`), {
    method: input ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
  let body;
  try { body = await response.json(); }
  catch { throw new Error('Unable to access listing reports. Please try again.'); }
  if (!response.ok) throw new Error(body.error || 'Unable to save listing report.');
  return body.data as T;
}
export const listOwnerSummaryReports = (offset=0) => request<{ reports: SummaryReportListItem[];nextOffset:number|null }>(undefined,offset);
export const previewOwnerSummaryReport = (report: string) => request<SummaryPreview>({ mode: 'preview', report });
export const reopenOwnerSummaryReport = (reportId: string) => request<SummaryPreview>({ mode: 'preview', reportId });
export const commitOwnerSummaryReport = (reportId: string, choices: SummaryChoice[], saveOnly = false) => request<SummaryPreview>({ mode: 'commit', reportId, choices, saveOnly });
