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
        negotiator = COALESCE($6, negotiator),
        agent = COALESCE($7, agent),
        no_tel = COALESCE($8, no_tel),
        available_units = COALESCE($9, available_units),
        status = COALESCE($10, status),
        date = COALESCE($11, date),
        renew_status = COALESCE($12, renew_status),
        notes = COALESCE($13, notes),
        updated_by_user_id = $14,
        updated_by_name = $15,
        updated_by_email = NULL,
        last_updated_at = NOW()
      WHERE id = $16
      RETURNING ${listingColumns}
    `, [
      body.property ?? null,
      body.projectCategory ?? null,
      body.location ?? null,
      body.tenure ?? null,
      body.pm ?? null,
      body.negotiator ?? null,
      body.agent ?? null,
      body.noTel ?? null,
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
