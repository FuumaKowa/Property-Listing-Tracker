import {mutatePublication} from './_publication-mutations';
import { importPublications } from './_publication-import';
import { getSessionUser, type AuthEnv, type AuthUser } from "./_auth";
import { getDb, json } from "./_db";
import {
  objectInput,
  positiveId,
  PublicationValidationError,
  validateChannelName,
  validatePublicationInput,
} from "../../src/publications";

export interface PublicationsContext {
  request: Request;
  env: AuthEnv;
  resource: "channels" | "publications" | "summaries" | "import";
  listingId?: string;
  id?: string;
}
export interface PublicationsServices {
  authenticate(request: Request, env: AuthEnv): Promise<AuthUser | null>;
  connect(env: AuthEnv): {
    query(sql: string, params?: any[]): Promise<Record<string, any>[]>;
  };
  transact?(env: AuthEnv, statements: {sql: string; params: any[]}[]): Promise<Record<string, any>[][]>;
}
const defaults: PublicationsServices = {
  authenticate: getSessionUser,
  connect: getDb,
  transact: async (env, statements) => {
    const db = getDb(env);
    return db.transaction(statements.map(({sql, params}) => db.query(sql, params)), {isolationLevel: 'ReadCommitted'});
  },
};
const channelColumns = 'id, name, archived_at AS "archivedAt"';
const publicationColumns =
  'id, version, listing_id AS "listingId", channel_id AS "channelId", url, label, notes';
const error = (message: string, status: number) =>
  json({ success: false, error: message }, status);
const success = (data: unknown, status = 200) =>
  json({ success: true, data }, status);
function routeId(value: string | undefined) {
  if (!value || !/^[1-9]\d*$/.test(value))
    throw new PublicationValidationError("Invalid ID.");
  return positiveId(Number(value));
}
export async function handlePublications(
  context: PublicationsContext,
  services = defaults,
): Promise<Response> {
  const { request, env, resource } = context;
  try {
    const user = await services.authenticate(request, env);
    if (!user) return error("Authentication required.", 401);
    const method = request.method;
    const db = services.connect(env);
    const body = (["POST", "PATCH"].includes(method) || (resource === "publications" && method === "DELETE"))
      ? objectInput(await request.json())
      : {};
    if (resource === 'import') {
      if (method !== 'POST') return error('Method not allowed.', 405);
      return await importPublications(env, services, user, routeId(context.listingId), body);
    }
    if (resource === "channels") {
      if (method === "GET" && !context.id)
        return success(
          await db.query(
            `SELECT ${channelColumns} FROM publication_channels ORDER BY archived_at NULLS FIRST, lower(name), id`,
          ),
        );
      if (method === "POST" && !context.id)
        return success(
          (
            await db.query(
              `INSERT INTO publication_channels(name) VALUES ($1) RETURNING ${channelColumns}`,
              [validateChannelName(body.name)],
            )
          )[0],
          201,
        );
      if (method === "PATCH" && context.id) {
        const id = routeId(context.id);
        if (!("name" in body) && !("archived" in body))
          return error("No changes supplied.", 400);
        if ("archived" in body && typeof body.archived !== "boolean")
          return error("Archived must be true or false.", 400);
        const rows = await db.query(
          `UPDATE publication_channels SET name=COALESCE($1,name), archived_at=CASE WHEN $2::boolean IS NULL THEN archived_at WHEN $2 THEN COALESCE(archived_at,now()) ELSE NULL END, updated_at=now() WHERE id=$3 RETURNING ${channelColumns}`,
          [
            "name" in body ? validateChannelName(body.name) : null,
            body.archived ?? null,
            id,
          ],
        );
        return rows[0] ? success(rows[0]) : error("Channel not found.", 404);
      }
    } else if (resource === "summaries" && method === "GET") {
      const values =
        new URL(request.url).searchParams.get("listingIds")?.split(",") || [];
      if (values.length < 1 || values.length > 200)
        return error("Supply between 1 and 200 listing IDs.", 400);
      const ids = [...new Set(values.map(routeId))];
      return success(
        await db.query(
          `SELECT p.listing_id AS "listingId", count(*)::int AS count, array_agg(DISTINCT c.name ORDER BY c.name) AS channels FROM listing_publications p JOIN publication_channels c ON c.id=p.channel_id WHERE p.listing_id=ANY($1::int[]) GROUP BY p.listing_id`,
          [ids],
        ),
      );
    } else if (resource === "publications") {
      const listingId = routeId(context.listingId);
      if (
        !(await db.query("SELECT id FROM listings WHERE id=$1", [listingId]))[0]
      )
        return error("Listing not found.", 404);
      if (method === "GET" && !context.id)
        return success(
          await db.query(
            `SELECT ${publicationColumns} FROM listing_publications WHERE listing_id=$1 ORDER BY id`,
            [listingId],
          ),
        );
      if ((method==='POST'&&!context.id)||(['PATCH','DELETE'].includes(method)&&context.id))
        return await mutatePublication(db,user,listingId,context.id?routeId(context.id):undefined,method,body);

    }
    return error("Method not allowed.", 405);
  } catch (caught) {
    if (
      caught instanceof PublicationValidationError ||
      caught instanceof SyntaxError
    )
      return error(
        caught instanceof SyntaxError ? "Invalid JSON." : caught.message,
        400,
      );
    if ((caught as { code?: string })?.code === "23505")
      return error(
        "A channel with that name already exists, including archived channels.",
        409,
      );
    if ((caught as { code?: string })?.code === "23503")
      return error("The listing or channel no longer exists.", 409);
    return error(
      "Unable to save or load publication data. Please try again.",
      500,
    );
  }
}
