import bcrypt from 'bcryptjs';
import { getDb, getErrorMessage, json, PagesEnv } from './_db';

export type AuthRole = 'super_admin' | 'admin' | 'user';

export interface AuthUser {
  id: number;
  username: string;
  displayName: string | null;
  role: AuthRole;
}

export interface AuthEnv extends PagesEnv {
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
}

const SESSION_COOKIE = 'property_tracker_session';
const SESSION_DAYS = 30;

function cookieValue(request: Request) {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match?.[1];
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function newSessionToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`;
}

function sessionCookie(token: string, maxAge: number) {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

async function ensureTables(db: ReturnType<typeof getDb>) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      display_name TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      last_login_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id SERIAL PRIMARY KEY,
      session_token_hash TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

export async function ensureDefaultAdmin(env: AuthEnv) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be configured in Cloudflare Pages secrets.');
  }

  const db = getDb(env);
  await ensureTables(db);
  const existing = await db.query('SELECT id FROM auth_users WHERE username = $1 LIMIT 1', [env.ADMIN_USERNAME]);
  if (!existing[0]) {
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
    await db.query(
      `INSERT INTO auth_users (username, password_hash, role, display_name) VALUES ($1, $2, 'super_admin', $3)`,
      [env.ADMIN_USERNAME, passwordHash, env.ADMIN_USERNAME]
    );
  }
}

export async function getSessionUser(request: Request, env: AuthEnv): Promise<AuthUser | null> {
  const token = cookieValue(request);
  if (!token) return null;

  const db = getDb(env);
  await ensureTables(db);
  const tokenHash = await sha256(token);
  const rows = await db.query(
    `SELECT u.id, u.username, u.display_name AS "displayName", u.role
     FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
     WHERE s.session_token_hash = $1 AND s.expires_at > NOW() LIMIT 1`,
    [tokenHash]
  );
  return (rows[0] as AuthUser | undefined) || null;
}

export async function login(request: Request, env: AuthEnv) {
  const body = await request.json() as { username?: string; password?: string };
  if (!body.username || !body.password) return json({ error: 'Username and password are required.' }, 400);

  await ensureDefaultAdmin(env);
  const db = getDb(env);
  const rows = await db.query(
    `SELECT id, username, password_hash AS "passwordHash", display_name AS "displayName", role FROM auth_users WHERE username = $1 LIMIT 1`,
    [body.username.trim()]
  );
  const user = rows[0] as (AuthUser & { passwordHash: string }) | undefined;
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    return json({ error: 'Invalid username or password.' }, 401);
  }

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.query(
    `INSERT INTO auth_sessions (session_token_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
    [await sha256(token), user.id, expiresAt.toISOString()]
  );
  await db.query('UPDATE auth_users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const { passwordHash: _passwordHash, ...safeUser } = user;
  return new Response(JSON.stringify({ success: true, user: safeUser }), {
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 24 * 60 * 60) },
  });
}

export async function logout(request: Request, env: AuthEnv) {
  const token = cookieValue(request);
  if (token) {
    const db = getDb(env);
    await ensureTables(db);
    await db.query('DELETE FROM auth_sessions WHERE session_token_hash = $1', [await sha256(token)]);
  }
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie('', 0) },
  });
}

export function authError(message = 'You must sign in first.') {
  return json({ error: message }, 401);
}

export function roleError() {
  return json({ error: 'Only administrators can manage users.' }, 403);
}

export function authFailure(error: unknown) {
  return json({ error: getErrorMessage(error) }, 500);
}
