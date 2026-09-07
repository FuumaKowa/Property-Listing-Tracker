import { getDb, getErrorMessage, json, PagesEnv } from './_db';
import { authError, AuthEnv, getSessionUser } from './_auth';

export const onRequestGet = async ({ env, request }: { env: AuthEnv; request: Request }) => {
  try {
    const user = await getSessionUser(request, env);
    if (!user) return authError();
    const listingId = new URL(request.url).searchParams.get('listingId');
    const db = getDb(env);
    const rows = listingId
      ? await db.query(
          `SELECT id, listing_id AS "listingId", action, changed_fields AS "changedFields", user_name AS "userName", user_email AS "userEmail", user_uid AS "userUid", timestamp FROM listing_audit_logs WHERE listing_id = $1 ORDER BY timestamp DESC LIMIT 100`,
          [Number(listingId)]
        )
      : await db.query(
          `SELECT id, listing_id AS "listingId", action, changed_fields AS "changedFields", user_name AS "userName", user_email AS "userEmail", user_uid AS "userUid", timestamp FROM listing_audit_logs ORDER BY timestamp DESC LIMIT 200`
        );

    return json({ success: true, data: rows });
  } catch (error) {
    return json({ success: false, error: getErrorMessage(error) }, 500);
  }
};
