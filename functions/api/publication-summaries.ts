import { handlePublications } from './_publications';
import type { AuthEnv } from './_auth';
export const onRequest = (context: { request: Request; env: AuthEnv }) => handlePublications({ ...context, resource: 'summaries' });
