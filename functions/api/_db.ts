import { neon } from '@neondatabase/serverless';

export interface PagesEnv {
  DATABASE_URL: string;
}

export function getDb(env: PagesEnv) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured in Cloudflare Pages environment variables.');
  }

  return neon(env.DATABASE_URL);
}

export const listingColumns = `
  id,
  property,
  project_category AS "projectCategory",
  location,
  tenure,
  pm,
  available_units AS "availableUnits",
  status,
  date,
  renew_status AS "renewStatus",
  notes,
  updated_by_user_id AS "updatedByUserId",
  updated_by_name AS "updatedByName",
  updated_by_email AS "updatedByEmail",
  last_updated_at AS "lastUpdatedAt",
  created_at AS "createdAt"
`;

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected database error';
}
