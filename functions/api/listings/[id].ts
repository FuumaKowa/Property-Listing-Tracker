import { getDb, getErrorMessage, json, listingColumns, PagesEnv } from '../_db';
import { authError, AuthEnv, getSessionUser } from '../_auth';

export const onRequestPatch = async ({ env, request, params }: { env: AuthEnv; request: Request; params: { id?: string } }) => {
  try {
    const user = await getSessionUser(request, env);
    if (!user) return authError();
    const id = Number(params.id);
    if (!Number.isInteger(id)) {
      return json({ success: false, error: 'Invalid listing ID.' }, 400);
    }

    const body = await request.json() as Record<string, string | undefined>;
    const db = getDb(env);
    const rows = await db.query(`
      UPDATE listings
      SET
        property = COALESCE($1, property),
        project_category = COALESCE($2, project_category),
        location = COALESCE($3, location),
        tenure = COALESCE($4, tenure),
        pm = COALESCE($5, pm),
        available_units = COALESCE($6, available_units),
        status = COALESCE($7, status),
        date = COALESCE($8, date),
        renew_status = COALESCE($9, renew_status),
        notes = COALESCE($10, notes),
        updated_by_user_id = $11,
        updated_by_name = $12,
        updated_by_email = NULL,
        last_updated_at = NOW()
      WHERE id = $13
      RETURNING ${listingColumns}
    `, [
      body.property ?? null,
      body.projectCategory ?? null,
      body.location ?? null,
      body.tenure ?? null,
      body.pm ?? null,
      body.availableUnits ?? null,
      body.status ?? null,
      body.date ?? null,
      body.renewStatus ?? null,
      body.notes ?? null,
      String(user.id),
      user.displayName || user.username,
      id,
    ]);

    if (!rows[0]) {
      return json({ success: false, error: 'Listing not found.' }, 404);
    }

    return json({ success: true, data: rows[0] });
  } catch (error) {
    return json({ success: false, error: getErrorMessage(error) }, 500);
  }
};

export const onRequestDelete = async ({ env, request, params }: { env: AuthEnv; request: Request; params: { id?: string } }) => {
  try {
    const user = await getSessionUser(request, env);
    if (!user) return authError();
    const id = Number(params.id);
    if (!Number.isInteger(id)) {
      return json({ success: false, error: 'Invalid listing ID.' }, 400);
    }

    const db = getDb(env);
    const rows = await db`DELETE FROM listings WHERE id = ${id} RETURNING id`;
    if (!rows[0]) {
      return json({ success: false, error: 'Listing not found.' }, 404);
    }

    return json({ success: true, message: `Listing ${id} deleted` });
  } catch (error) {
    return json({ success: false, error: getErrorMessage(error) }, 500);
  }
};
