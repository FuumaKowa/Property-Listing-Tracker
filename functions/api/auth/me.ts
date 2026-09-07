import { authFailure, AuthEnv, getSessionUser } from '../_auth';
import { json } from '../_db';

export const onRequestGet = async ({ env, request }: { env: AuthEnv; request: Request }) => {
  try {
    const user = await getSessionUser(request, env);
    return json({ authenticated: Boolean(user), user });
  } catch (error) {
    return authFailure(error);
  }
};
