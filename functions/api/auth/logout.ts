import { AuthEnv, authFailure, logout } from '../_auth';

export const onRequestPost = async ({ env, request }: { env: AuthEnv; request: Request }) => {
  try {
    return await logout(request, env);
  } catch (error) {
    return authFailure(error);
  }
};
