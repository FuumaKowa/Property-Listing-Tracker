import { authFailure, AuthEnv, login } from '../_auth';

export const onRequestPost = async ({ env, request }: { env: AuthEnv; request: Request }) => {
  try {
    return await login(request, env);
  } catch (error) {
    return authFailure(error);
  }
};
