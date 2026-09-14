import { drizzle } from 'drizzle-orm/neon-http';
import { getDb, type PagesEnv } from '../../_db';
import * as schema from '../../../../src/db/schema';
import { handleN8nPages } from '../../../../src/server/n8n/pages';

interface N8nEnv extends PagesEnv { N8N_INGEST_API_KEY?: string }

// OwnerHunter exclusively writes Master Listing Owner using a server-side secret binding.
export const onRequest = ({ request, env }: { request: Request; env: N8nEnv }) =>
  handleN8nPages(request, env.N8N_INGEST_API_KEY, statement => {
    // Wrap the existing HTTP client only after authentication and input validation.
    const db = drizzle(getDb(env), { schema });
    return db.execute(statement);
  });
