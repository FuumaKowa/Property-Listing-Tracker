import bcrypt from 'bcryptjs';
import { authError, authFailure, AuthEnv, getSessionUser, roleError } from './_auth';
import { getDb, json } from './_db';

export const onRequestGet = async ({ env, request }: { env: AuthEnv; request: Request }) => {
  try {
    const currentUser = await getSessionUser(request, env);
    if (!currentUser) return authError();
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'admin') return roleError();

    const db = getDb(env);
    const rows = await db.query(
      `SELECT id, username, display_name AS "displayName", role, created_at AS "createdAt", last_login_at AS "lastLoginAt" FROM auth_users ORDER BY username`
    );
    return json({ success: true, data: rows });
  } catch (error) {
    return authFailure(error);
  }
};

export const onRequestPost = async ({ env, request }: { env: AuthEnv; request: Request }) => {
  try {
    const currentUser = await getSessionUser(request, env);
    if (!currentUser) return authError();
    if (currentUser.role !== 'super_admin') return roleError();

    const body = await request.json() as { username?: string; password?: string; displayName?: string; role?: string };
    const username = body.username?.trim();
    if (!username || !body.password || body.password.length < 8) {
      return json({ error: 'Username and a password of at least 8 characters are required.' }, 400);
    }
    const role = body.role === 'admin' ? 'admin' : 'user';
    const db = getDb(env);
    const passwordHash = await bcrypt.hash(body.password, 12);
    const rows = await db.query(
      `INSERT INTO auth_users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, display_name AS "displayName", role`,
      [username, passwordHash, body.displayName?.trim() || username, role]
    );
    return json({ success: true, data: rows[0] }, 201);
  } catch (error) {
    return authFailure(error);
  }
};
