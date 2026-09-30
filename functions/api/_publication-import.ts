import { json } from './_db';
import type { AuthEnv, AuthUser } from './_auth';
import type { PublicationsServices } from './_publications';
import { PublicationValidationError, validatePublicationInput } from '../../src/publications';

export async function importPublications(env: AuthEnv, services: PublicationsServices, user: AuthUser, listingId: number, body: Record<string, unknown>) {
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100)
    throw new PublicationValidationError('Select between 1 and 100 links to import.');
  const items = body.items.map(item => {
    const validated = validatePublicationInput(item);
    return {...validated, url: new URL(validated.url).href};
  });
  // Legacy manual links may predate URL normalization. Retain their exact strings
  // as aliases, without modifying existing records. New manual saves use the same
  // canonical URL validation, so concurrent additions use the canonical spelling.
  const legacy = await services.connect(env).query('SELECT url FROM listing_publications WHERE listing_id=$1', [listingId]);
  const aliases = new Map<string, string[]>();
  for (const row of legacy) {
    try {
      const canonical = new URL(row.url.trim()).href;
      aliases.set(canonical, [...(aliases.get(canonical) || []), row.url.trim()]);
    } catch { /* Keep unparseable legacy values untouched. */ }
  }
  const prepared = items.map(item => ({...item, existingUrls: [item.url, ...(aliases.get(item.url) || [])]}));
  if (!services.transact) throw new Error('Import transaction service is unavailable.');
  // A separate lock statement is essential: after another import commits, the next
  // READ COMMITTED statement sees its links. A lock inside one CTE alone would use
  // an older snapshot and could allow two concurrent imports to insert duplicates.
  const [parent, outcome, links] = await services.transact(env, [
    {sql: 'SELECT id, archived_at FROM listings WHERE id=$1 FOR UPDATE', params: [listingId]},
    {sql: `WITH input AS MATERIALIZED (
        SELECT * FROM jsonb_to_recordset($2::jsonb) AS x("channelId" integer, url text, label text, notes text, "existingUrls" text[])
      ), channels AS MATERIALIZED (
        SELECT c.id FROM publication_channels c WHERE c.id IN (SELECT "channelId" FROM input) AND c.archived_at IS NULL ORDER BY c.id FOR SHARE
      ), eligible AS (
        SELECT id FROM listings WHERE id=$1 AND archived_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM input i WHERE NOT EXISTS (SELECT 1 FROM channels c WHERE c.id=i."channelId"))
      ), changed AS (
        INSERT INTO listing_publications(listing_id, channel_id, url, label, notes)
        SELECT e.id, i."channelId", i.url, i.label, i.notes FROM eligible e CROSS JOIN
          (SELECT DISTINCT ON (url) * FROM input ORDER BY url, "channelId") i
        WHERE NOT EXISTS (SELECT 1 FROM listing_publications p WHERE p.listing_id=$1 AND trim(p.url)=ANY(i."existingUrls"))
        RETURNING *
      ), audit AS (
        INSERT INTO listing_audit_logs(listing_id,action,changed_fields,user_uid,user_name)
        SELECT listing_id,'advertisement_create',jsonb_build_object('before',NULL,'after',to_jsonb(changed))::text,$3,$4 FROM changed
      ) SELECT (SELECT count(*)::int FROM changed) AS added,
        EXISTS (SELECT 1 FROM eligible) AS eligible`,
      params: [listingId, JSON.stringify(prepared), String(user.id), user.displayName || user.username]},
    {sql: 'SELECT id,version,listing_id AS "listingId",channel_id AS "channelId",url,label,notes FROM listing_publications WHERE listing_id=$1 ORDER BY id', params: [listingId]},
  ]);
  if (!parent.length) return json({success:false,error:'Listing not found.'},404);
  if (parent[0].archived_at) return json({success:false,error:'This property is archived. Restore it before importing links.'},409);
  if (!outcome[0].eligible) return json({success:false,error:'One or more channels are unavailable. Reopen the property card and select active channels.'},400);
  return json({success:true,data:{links,added:outcome[0].added,skipped:items.length-outcome[0].added}});
}
