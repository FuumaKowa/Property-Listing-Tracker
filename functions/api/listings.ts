import { getDb, getErrorMessage, json, listingColumns, PagesEnv } from './_db';
import { authError, AuthEnv, getSessionUser } from './_auth';
import { validatePriority } from '../../src/utils/listingPresentation';
import { validateRepostFields, PublicationValidationError } from '../../src/publications';

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

export const onRequestPost = async ({ env, request }: { env: AuthEnv; request: Request }, services = { getDb, getSessionUser }) => {
  try {
    const user = await services.getSessionUser(request, env);
    if (!user) return authError();
    const body = await request.json() as Record<string, any>;
    const repost = validateRepostFields(body);
    const priority = validatePriority(body);
    if (!body.property || !body.location) {
      return json({ success: false, error: 'Property and location are required.' }, 400);
    }

    const db = services.getDb(env);
    const rows = await db.query(`
      INSERT INTO listings (
        property, project_category, location, tenure, pm, negotiator, agent, no_tel, available_units,
        status, date, renew_status, notes, updated_by_user_id, updated_by_name, updated_by_email, last_updated_at, property_guru_repost_date, property_guru_repost_mode, created_by_user_id, created_by_name, is_priority
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), $17, $18, $19, $20, $21
      )
      RETURNING ${listingColumns}
    `, [
      body.property,
      body.projectCategory || 'Project Marketing (PM)',
      body.location,
      body.tenure || '-',
      body.pm || '-',
      body.negotiator || null,
      body.agent || null,
      body.noTel || null,
      body.availableUnits || '-',
      body.status || 'Active',
      body.date || '',
      body.renewStatus || 'Not Renewed',
      body.notes || null,
      String(user.id),
      user.displayName || user.username,
      null,
      repost.propertyGuruRepostDate ?? null,
      repost.propertyGuruRepostMode ?? null,
      String(user.id), user.displayName || user.username, priority.isPriority ?? false,
    ]);

    return json({ success: true, data: rows[0] }, 201);
  } catch (error) {
    if (error instanceof PublicationValidationError) return json({success:false,error:error.message},400);
    return json({ success: false, error: getErrorMessage(error) }, 500);
  }
};
