import bcrypt from 'bcryptjs';
import { authError, authFailure, AuthEnv, getSessionUser, roleError } from '../_auth';
import { getDb, json } from '../_db';

export const onRequestPatch = async ({ env, request, params }: { env: AuthEnv; request: Request; params: { id?: string } }) => {
  try {
    const currentUser = await getSessionUser(request, env);
    if (!currentUser) return authError();
    if (currentUser.role !== 'super_admin') return roleError();

    const id = Number(params.id);
    if (!Number.isInteger(id)) return json({ error: 'Invalid user ID.' }, 400);

    const body = await request.json() as {
      username?: string;
      displayName?: string;
      password?: string;
      role?: string;
    };
    const username = body.username?.trim();
    if (!username) return json({ error: 'Username is required.' }, 400);
    if (body.password !== undefined && body.password.length < 8) {
      return json({ error: 'Password must be at least 8 characters.' }, 400);
    }

    const db = getDb(env);
    const passwordHash = body.password ? await bcrypt.hash(body.password, 12) : null;
    const role = body.role === 'admin' ? 'admin' : 'user';
    const rows = await db.query(
      `UPDATE auth_users
       SET username = $1,
           display_name = $2,
           role = CASE WHEN id = $3 THEN role ELSE $4 END,
           password_hash = COALESCE($5, password_hash)
       WHERE id = $3
       RETURNING id, username, display_name AS "displayName", role, created_at AS "createdAt", last_login_at AS "lastLoginAt"`,
      [username, body.displayName?.trim() || username, id, role, passwordHash]
    );
    if (!rows[0]) return json({ error: 'User not found.' }, 404);
    return json({ success: true, data: rows[0] });
  } catch (error) {
    return authFailure(error);
  }
};

export const onRequestDelete = async ({ env, request, params }: { env: AuthEnv; request: Request; params: { id?: string } }) => {
  try {
    const currentUser = await getSessionUser(request, env);
    if (!currentUser) return authError();
    if (currentUser.role !== 'super_admin') return roleError();

    const id = Number(params.id);
    if (!Number.isInteger(id)) return json({ error: 'Invalid user ID.' }, 400);
    if (id === currentUser.id) return json({ error: 'You cannot delete your own account.' }, 400);

    const db = getDb(env);
    const target = await db.query('SELECT role FROM auth_users WHERE id = $1 LIMIT 1', [id]);
    if (!target[0]) return json({ error: 'User not found.' }, 404);
    if (target[0].role === 'super_admin') return json({ error: 'The super admin account cannot be deleted.' }, 400);

    await db.query('DELETE FROM auth_users WHERE id = $1', [id]);
    return json({ success: true });
  } catch (error) {
    return authFailure(error);
  }
};
