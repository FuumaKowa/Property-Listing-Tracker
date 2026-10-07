import { AuthEnv, authError, getSessionUser } from "./_auth";
import { getDb, json } from "./_db";
import {
  type OwnerListingDb,
  ownerColumns,
  readOwnerListings,
} from "../../src/db/ownerListings";
import { validateOwnerListing, OWNER_STATUSES } from "../../src/ownerListing";

interface Context {
  env: AuthEnv;
  request: Request;
  params?: { id?: string };
  action?: string;
}
export interface OwnerServices {
  authenticate: typeof getSessionUser;
  connect: (env: AuthEnv) => OwnerListingDb;
}
const fail = (error: string, status = 400) => json({ error }, status);
export async function handleOwnerListings(
  { env, request, params, action }: Context,
  services: OwnerServices = { authenticate: getSessionUser, connect: getDb },
) {
  try {
    const user = await services.authenticate(request, env);
    if (!user) return authError();
    const db = services.connect(env),
      method = request.method,
      admin = ["admin", "super_admin"].includes(user.role),
      name = user.displayName || user.username;
    const id = params?.id === undefined ? undefined : Number(params.id);
    if (
      id !== undefined &&
      (!/^[1-9]\d*$/.test(params!.id!) || !Number.isSafeInteger(id))
    )
      return fail("Invalid owner listing ID.");
    if (action === "settings") {
      if (method === "GET") {
        const rules = await db.query(
          'SELECT key,agent_label AS "agentLabel",areas,user_id AS "userId" FROM owner_assignment_rules ORDER BY key',
        );
        const agents = await db.query(
          "SELECT id,coalesce(nullif(display_name,''),username) AS name FROM auth_users ORDER BY username",
        );
        return json({ success: true, data: { rules, agents } });
      }
      if (method !== "PATCH") return fail("Method not allowed.", 405);
      if (!admin) return fail("Only Admin can configure assignments.", 403);
      const body = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body))
        return fail("Invalid request.");
      if (
        typeof body.key !== "string" ||
        !(
          body.userId === null ||
          (Number.isSafeInteger(body.userId) && body.userId > 0)
        )
      )
        return fail("Select an agent account.");
      const rows = await db.query(
        `WITH old AS MATERIALIZED(SELECT * FROM owner_assignment_rules WHERE key=$1 FOR UPDATE), changed AS(
    UPDATE owner_assignment_rules r SET user_id=$2 FROM old o WHERE r.key=o.key AND ($2::int IS NULL OR EXISTS(SELECT 1 FROM auth_users WHERE id=$2)) RETURNING r.*),
    logged AS(INSERT INTO owner_listing_events(action,actor_id,actor_name,before_record,after_record) SELECT 'assignment_rule',$3,$4,to_jsonb(o),to_jsonb(c) FROM changed c JOIN old o ON c.key=o.key) SELECT * FROM changed`,
        [body.key, body.userId, user.id, name],
      );
      return rows[0]
        ? json({ success: true, data: rows[0] })
        : fail("Rule or agent not found.", 404);
    }
    if (method === "GET" && !id && !action)
      return json({ success: true, data: await readOwnerListings(db) });
    if (action === "history" && id && method === "GET")
      return json({
        success: true,
        data: await db.query(
          `SELECT id,action,actor_name AS "actorName",note,created_at AS "createdAt",before_record->>'assigned_agent_name' AS "previousAgent",after_record->>'assigned_agent_name' AS "assignedAgent",after_record->>'seeding_status' AS "seedingStatus",after_record->>'status' AS status FROM owner_listing_events WHERE listing_id=$1 ORDER BY id DESC LIMIT 200`,
          [id],
        ),
      });
    if (!["POST", "PATCH", "DELETE"].includes(method))
      return fail("Method not allowed.", 405);
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return fail("Invalid request.");
    if (method === "POST" && !id && !action) {
      let input;
      try {
        input = validateOwnerListing(body);
      } catch (e) {
        return fail((e as Error).message);
      }
      const rows = await db.query(
        `INSERT INTO owner_listings(owner_name,no_tel,property_name,property_type,property_price,status,updated_by_name,property_link,location) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${ownerColumns}`,
        [
          input.ownerName,
          input.noTel,
          input.propertyName,
          input.propertyType,
          input.propertyPrice,
          input.status,
          name,
          input.propertyLink || "",
          input.location || null,
        ],
      );
      return json({ success: true, data: rows[0] }, 201);
    }
    if (!id) return fail("Listing ID is required.");
    if (!Number.isInteger(body.version) || body.version < 1)
      return fail(
        "Refresh this listing before saving. A current version is required.",
        428,
      );
    const paramsSql: any[] = [id, body.version, user.id, name, admin];
    const param = (value: unknown) => {
      paramsSql.push(value);
      return "$" + paramsSql.length;
    };
    const sets: string[] = [];
    let note: string | null = null,
      kind = "update";
    if (action === "assignment" && method === "POST") {
      if (!admin) return fail("Only Admin can reassign owner listings.", 403);
      let target: string;
      if (body.agentId === "auto")
        target = "public.owner_agent_for_location(o.location)";
      else if (body.agentId === null) target = "NULL::integer";
      else if (Number.isSafeInteger(body.agentId) && body.agentId > 0) {
        if (
          !(
            await db.query("SELECT id FROM auth_users WHERE id=$1", [
              body.agentId,
            ])
          ).length
        )
          return fail("Agent account not found.", 404);
        target = param(body.agentId);
      } else return fail("Select an agent or use the location rule.");
      sets.push(
        `assigned_agent_id=${target}`,
        `assigned_agent_name=(SELECT coalesce(nullif(display_name,''),username) FROM auth_users WHERE id=${target})`,
        `assigned_at=CASE WHEN ${target} IS NULL THEN NULL ELSE now() END`,
        "last_agent_activity_at=NULL",
      );
      kind = "assignment";
    } else if (action === "activity" && method === "PATCH") {
      if (body.seedingStatus !== undefined) {
        if (![null, "IFU1", "IFU2", "IFU3"].includes(body.seedingStatus))
          return fail("Select IFU1, IFU2 or IFU3.");
        sets.push("seeding_status=" + param(body.seedingStatus));
      }
      if (body.status !== undefined) {
        if (!OWNER_STATUSES.includes(body.status))
          return fail("Invalid status.");
        sets.push("status=" + param(body.status));
      }
      if (body.note !== undefined) {
        if (
          typeof body.note !== "string" ||
          !body.note.trim() ||
          body.note.trim().length > 4000
        )
          return fail("Follow-up note must contain 1-4000 characters.");
        note = body.note.trim();
      }
      if (!sets.length && !note)
        return fail("Add a follow-up note or change a stage or status.");
      kind = "activity";
    } else if (!action && method === "PATCH") {
      let input;
      try {
        input = validateOwnerListing(body);
      } catch (e) {
        return fail((e as Error).message);
      }
      const fields: Record<string, unknown> = {
        owner_name: input.ownerName,
        no_tel: input.noTel,
        property_name: input.propertyName,
        property_type: input.propertyType,
        property_price: input.propertyPrice,
        status: input.status,
      };
      if (input.propertyLink !== undefined)
        fields.property_link = input.propertyLink;
      if (input.location !== undefined) fields.location = input.location;
      for (const [key, value] of Object.entries(fields))
        sets.push(key + "=" + param(value));
    } else if (!action && method === "DELETE") {
      if (!admin) return fail("Only Admin can delete owner listings.", 403);
      kind = "delete";
    } else return fail("Method not allowed.", 405);
    const noteParam = param(note);
    let changedCheck = "TRUE";
    if (kind === "activity") {
      const checks: string[] = [];
      if (body.seedingStatus !== undefined)
        checks.push(
          "o.seeding_status IS DISTINCT FROM " + param(body.seedingStatus),
        );
      if (body.status !== undefined)
        checks.push("o.status IS DISTINCT FROM " + param(body.status));
      changedCheck = `(${noteParam}::text IS NOT NULL${checks.length ? " OR " + checks.join(" OR ") : ""})`;
    }
    if (kind !== "assignment" && kind !== "delete") {
      const statusChanged =
        kind !== "activity" && body.status !== undefined
          ? "o.status IS DISTINCT FROM " + param(body.status)
          : "FALSE";
      sets.push(
        `last_agent_activity_at=CASE WHEN o.assigned_agent_id=$3 AND (${kind === "activity" ? changedCheck : statusChanged}) THEN now() ELSE o.last_agent_activity_at END`,
      );
    }
    if (kind !== "delete")
      sets.push(
        "version=o.version+1",
        "updated_at=now()",
        "updated_by_name=$4",
      );
    const permission = "($5 OR o.assigned_agent_id=$3)";
    const mutation =
      kind === "delete"
        ? `DELETE FROM owner_listings l USING old o WHERE l.id=o.id AND l.version=$2 AND o.version=$2 AND $5 RETURNING l.*`
        : `UPDATE owner_listings l SET ${sets.join(",")} FROM old o WHERE l.id=o.id AND l.version=$2 AND o.version=$2 AND ${permission} AND ${changedCheck} RETURNING l.*`;
    const rows = await db.query(
      `WITH old AS MATERIALIZED(SELECT * FROM owner_listings WHERE id=$1 FOR UPDATE),changed AS(${mutation}),logged AS(INSERT INTO owner_listing_events(listing_id,action,actor_id,actor_name,note,before_record,after_record) SELECT ${kind === "delete" ? "NULL" : "c.id"},'${kind}',$3,$4,${noteParam},to_jsonb(o),${kind === "delete" ? "NULL" : "to_jsonb(c)"} FROM changed c JOIN old o ON c.id=o.id) SELECT ${ownerColumns} FROM changed`,
      paramsSql,
    );
    if (rows[0]) return json({ success: true, data: rows[0] });
    const current = (
      await db.query(
        "SELECT version,assigned_agent_id FROM owner_listings WHERE id=$1",
        [id],
      )
    )[0];
    if (!current) return fail("Owner listing not found.", 404);
    if (!admin && current.assigned_agent_id !== user.id)
      return fail(
        "Only the assigned agent or Admin can update this owner listing.",
        403,
      );
    if (current.version !== body.version)
      return fail(
        "This listing changed. Refresh and review before saving again.",
        409,
      );
    return fail(
      "No change recorded. Add a note or choose a different stage/status.",
    );
  } catch (e) {
    return fail(
      e instanceof SyntaxError
        ? "Invalid JSON."
        : "Unable to access owner listings. Please try again.",
      e instanceof SyntaxError ? 400 : 500,
    );
  }
}
