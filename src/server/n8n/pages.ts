import { validN8nKey } from './auth';
import { ingestListing, type ExecuteIngestQuery } from './repository';
import { IngestInputError, validateN8nListing } from './validation';

const reply = (body: unknown, status: number, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
});

async function readBody(request: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) throw new IngestInputError('Content-Type must be application/json.');
  const reader = request.body?.getReader();
  if (!reader) throw new IngestInputError('Body must be a JSON object.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 65536) { await reader.cancel(); throw new IngestInputError('Body must be valid JSON no larger than 64 KiB.'); }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof IngestInputError) throw error;
    throw new IngestInputError('Body must be valid JSON no larger than 64 KiB.');
  } finally { reader.releaseLock(); }
}

export async function handleN8nPages(request: Request, apiKey: string | undefined, execute: ExecuteIngestQuery): Promise<Response> {
  try {
    if (!await validN8nKey(request.headers.get('X-API-Key'), apiKey)) return reply({ success: false, error: 'Unauthorized.' }, 401);
    if (request.method !== 'POST') return reply({ success: false, error: 'Method not allowed.' }, 405, { Allow: 'POST' });
    const input = validateN8nListing(await readBody(request));
    const result = await ingestListing(execute, input);
    return reply(result, result.status === 'created' ? 201 : 200);
  } catch (error) {
    return reply({ success: false, error: error instanceof IngestInputError ? error.message : 'Unable to store listing. Please retry.' }, error instanceof IngestInputError ? 400 : 500);
  }
}
