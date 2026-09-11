import { AuthEnv, authError, getSessionUser } from './_auth';
import { getDb, getErrorMessage, json } from './_db';
import { OwnerListingDb, ownerListingsTableSql, readOwnerListings, writeOwnerListing, removeOwnerListing } from '../../src/db/ownerListings';
import { validateOwnerListing } from '../../src/ownerListing';

interface Context { env: AuthEnv; request: Request; params?: { id?: string } }
interface Services {
  authenticate: typeof getSessionUser;
  connect: (env: AuthEnv) => OwnerListingDb;
}

export async function handleOwnerListings({ env, request, params }: Context, services: Services = { authenticate: getSessionUser, connect: getDb }) {
  try {
    const user = await services.authenticate(request, env);
    if (!user) return authError();
    const id = params?.id === undefined ? undefined : Number(params.id);
    if (id !== undefined && (!Number.isSafeInteger(id) || id <= 0)) return json({ error: 'Invalid owner listing ID.' }, 400);
    const method = request.method;
    if (!((id === undefined && ['GET', 'POST'].includes(method)) || (id !== undefined && ['PATCH', 'DELETE'].includes(method)))) {
      return json({ error: 'Method not allowed.' }, 405);
    }
    let input;
    if (method === 'POST' || method === 'PATCH') {
      try { input = validateOwnerListing(await request.json()); }
      catch (error) { return json({ error: getErrorMessage(error) }, 400); }
    }
    const db = services.connect(env);
    await db.query(ownerListingsTableSql);
    if (method === 'GET') return json({ success: true, data: await readOwnerListings(db) });
    if (method === 'DELETE') {
      return await removeOwnerListing(db, id!) ? json({ success: true }) : json({ error: 'Owner listing not found.' }, 404);
    }
    const data = await writeOwnerListing(db, input!, user.displayName || user.username, id);
    return data ? json({ success: true, data }, method === 'POST' ? 201 : 200) : json({ error: 'Owner listing not found.' }, 404);
  } catch (error) {
    console.error('Owner listing request failed:', getErrorMessage(error));
    return json({ error: 'Unable to access owner listings. Please try again.' }, 500);
  }
}
