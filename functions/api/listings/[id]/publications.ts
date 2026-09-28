import { handlePublications } from '../../_publications';
import type { AuthEnv } from '../../_auth';
export const onRequest = (context: { request: Request; env: AuthEnv; params: { id: string } }) => handlePublications({ ...context, resource: 'publications', listingId: context.params.id });
