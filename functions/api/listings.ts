import { getDb, getErrorMessage, json, listingColumns, PagesEnv } from './_db';
import { authError, AuthEnv, getSessionUser } from './_auth';

export const onRequestGet = async ({ env, request }: { env: AuthEnv; request: Request }) => {
  try {
    const user = await getSessionUser(request, env);
    if (!user) return authError();
    const db = getDb(env);
    const rows = await db.query(`SELECT ${listingColumns} FROM listings ORDER BY id`);
    return json({ success: true, data: rows });
  } catch (error) {
    return json({ success: false, error: getErrorMessage(error) }, 500);
  }
};

export const onRequestPost = async ({ env, request }: { env: AuthEnv; request: Request }) => {
  try {
    const user = await getSessionUser(request, env);
    if (!user) return authError();
    const body = await request.json() as Record<string, string | undefined>;
    if (!body.property || !body.location) {
      return json({ success: false, error: 'Property and location are required.' }, 400);
    }

    const db = getDb(env);
    const rows = await db.query(`
      INSERT INTO listings (
        property, project_category, location, tenure, pm, available_units,
        status, date, renew_status, notes, updated_by_name, updated_by_email, last_updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
      )
      RETURNING ${listingColumns}
    `, [
      body.property,
      body.projectCategory || 'Project Marketing (PM)',
      body.location,
      body.tenure || '-',
      body.pm || '-',
      body.availableUnits || '-',
      body.status || 'Active',
      body.date || '',
      body.renewStatus || 'Not Renewed',
      body.notes || null,
      body.updatedByName || user.displayName || user.username,
      body.updatedByEmail || null,
    ]);

    return json({ success: true, data: rows[0] }, 201);
  } catch (error) {
    return json({ success: false, error: getErrorMessage(error) }, 500);
  }
};
