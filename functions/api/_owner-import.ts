import { json } from "./_db";
import type { AuthEnv, AuthUser } from "./_auth";
import type { OwnerServices } from "./_owner-listings";
import {
  normalizeOwnerImport,
  OWNER_IMPORT_LIMIT,
  type OwnerImportRow,
} from "../../src/ownerImport";

// Conservative matches are warnings, never updates. One predicate is used in preview and commit.
const textKey = (v: string) =>
  `regexp_replace(lower(trim(coalesce(${v},''))), '\\s+', ' ', 'g')`;
const urlKey = (v: string) =>
  `regexp_replace(regexp_replace(split_part(lower(trim(coalesce(${v},''))),'#',1),'^https?://(www\\.)?','','i'),'/+$','')`;
const phoneKey = (v: string) =>
  `regexp_replace(regexp_replace(coalesce(${v},''),'[^0-9]','','g'),'^0','60')`;
function duplicate(a: string, b: string) {
  return `((${urlKey(`${a}.property_link`)}<>'' AND ${urlKey(`${a}.property_link`)}=${urlKey(`${b}.property_link`)}) OR
    (${textKey(`${a}.property_name`)}=${textKey(`${b}.property_name`)} AND ${a}.property_type=${b}.property_type AND ${a}.property_price=${b}.property_price AND
      ((${phoneKey(`${a}.no_tel`)}<>'' AND ${phoneKey(`${a}.no_tel`)}=${phoneKey(`${b}.no_tel`)}) OR
       (${textKey(`${a}.owner_name`)} NOT IN ('','not captured') AND ${textKey(`${a}.owner_name`)}=${textKey(`${b}.owner_name`)}) OR
       (${textKey(`${a}.owner_name`)} IN ('','not captured') AND ${textKey(`${b}.owner_name`)} IN ('','not captured') AND ${phoneKey(`${a}.no_tel`)}='' AND ${phoneKey(`${b}.no_tel`)}=''))))`;
}
const inputSql = `SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(row integer,owner_name text,no_tel text,property_name text,property_type text,property_price numeric,status text,property_link text,location text,seeding_status text,choice text)`;
const error = (message: string, status = 400) =>
  json({ error: message }, status);
export async function importOwners(
  request: Request,
  env: AuthEnv,
  services: OwnerServices,
  user: AuthUser,
) {
  if (request.method !== "POST") return error("Method not allowed.", 405);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 512 * 1024)
    return error("Import is too large. Use at most 200 rows.", 413);
  const body = JSON.parse(raw);
  if (
    !body ||
    !["preview", "commit"].includes(body.mode) ||
    !Array.isArray(body.rows) ||
    !body.rows.length ||
    body.rows.length > OWNER_IMPORT_LIMIT
  )
    return error("Select between 1 and 200 rows to preview or import.");
  const rows: OwnerImportRow[] = body.rows.map((value: unknown, i: number) => {
    try {
      return {
        row: i + 1,
        kind: "new",
        input: normalizeOwnerImport(value),
        matches: [],
      };
    } catch (e) {
      return {
        row: i + 1,
        kind: "invalid",
        error: (e as Error).message,
        matches: [],
      };
    }
  });
  const prepared = rows
    .filter((r) => r.input)
    .map((r) => ({
      row: r.row,
      owner_name: r.input!.ownerName,
      no_tel: r.input!.noTel,
      property_name: r.input!.propertyName,
      property_type: r.input!.propertyType,
      property_price: r.input!.propertyPrice,
      status: r.input!.status,
      property_link: r.input!.propertyLink || "",
      location: r.input!.location || null,
      seeding_status: r.input!.seedingStatus,
      choice: body.choices?.[r.row - 1] || "new",
    }));
  if (body.mode === "preview") {
    const matches = await services.connect(env).query(
      `WITH input AS MATERIALIZED(${inputSql})
      SELECT i.row,
        (SELECT coalesce(jsonb_agg(m),'[]') FROM (SELECT e.id,e.property_name AS name FROM public.owner_listings e WHERE ${duplicate("i", "e")} ORDER BY e.id LIMIT 5) m) AS existing,
        (SELECT coalesce(jsonb_agg(m),'[]') FROM (SELECT p.row,p.property_name AS name FROM input p WHERE p.row<i.row AND ${duplicate("i", "p")} ORDER BY p.row LIMIT 5) m) AS previous
      FROM input i`,
      [JSON.stringify(prepared)],
    );
    for (const m of matches) {
      const row = rows[Number(m.row) - 1];
      row.matches = [
        ...(m.existing as OwnerImportRow["matches"]),
        ...(m.previous as OwnerImportRow["matches"]),
      ];
      if (row.matches.length) row.kind = "duplicate";
    }
    return json({ success: true, data: { rows } });
  }
  if (
    !Array.isArray(body.choices) ||
    body.choices.length !== rows.length ||
    body.choices.some(
      (c: unknown) => !["new", "skip", "append"].includes(c as string),
    )
  )
    return error("Choose Skip or Append for every row.");
  if (rows.some((r) => !r.input && body.choices[r.row - 1] !== "skip"))
    return error(
      "Invalid rows cannot be appended. Correct the file or skip those rows.",
    );
  if (
    typeof body.importId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.importId)
  )
    return error("An import request ID is required. Reopen the import.");
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          JSON.stringify({ rows: body.rows, choices: body.choices }),
        ),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (!services.transact) throw new Error("Import transaction unavailable");
  // Serialize only owner writes. A separate statement gives the import a fresh READ COMMITTED
  // snapshot after a concurrent writer commits. No normal listing table is accessed.
  const results = await services.transact(env, [
    { sql: "SET LOCAL lock_timeout='5s'", params: [] },
    {
      sql: "LOCK TABLE public.owner_listings IN SHARE ROW EXCLUSIVE MODE",
      params: [],
    },
    {
      sql: `WITH input AS MATERIALIZED(${inputSql}),
      previous AS MATERIALIZED(SELECT after_record FROM public.owner_listing_events WHERE action='import' AND actor_id=$2 AND after_record->>'importId'=$3 ORDER BY id LIMIT 1),
      eligible AS MATERIALIZED(SELECT i.* FROM input i WHERE NOT EXISTS(SELECT 1 FROM previous) AND i.choice<>'skip' AND
        (i.choice='append' OR (NOT EXISTS(SELECT 1 FROM public.owner_listings e WHERE ${duplicate("i", "e")}) AND
          NOT EXISTS(SELECT 1 FROM input p WHERE p.row<i.row AND p.choice<>'skip' AND ${duplicate("i", "p")})))),
      changed AS(INSERT INTO public.owner_listings(owner_name,no_tel,property_name,property_type,property_price,status,updated_by_name,property_link,location,seeding_status)
        SELECT owner_name,no_tel,property_name,property_type,property_price,status,$4,property_link,location,seeding_status FROM eligible ORDER BY row RETURNING id),
      outcome AS(SELECT jsonb_build_object('added',(SELECT count(*)::int FROM changed),'skipped',$5::int-(SELECT count(*)::int FROM changed),
        'createdIds',(SELECT coalesce(jsonb_agg(id),'[]') FROM changed),
        'skippedRows',(SELECT coalesce(jsonb_agg(n ORDER BY n),'[]') FROM generate_series(1,$5::int) n WHERE NOT EXISTS(SELECT 1 FROM eligible e WHERE e.row=n))) AS result),
      logged AS(INSERT INTO public.owner_listing_events(action,actor_id,actor_name,note,after_record)
        SELECT 'import',$2,$4,'Spreadsheet import',jsonb_build_object('importId',$3::text,'hash',$6::text,'result',result) FROM outcome WHERE NOT EXISTS(SELECT 1 FROM previous) RETURNING after_record)
      SELECT after_record FROM previous UNION ALL SELECT after_record FROM logged`,
      params: [
        JSON.stringify(prepared),
        user.id,
        body.importId,
        user.displayName || user.username,
        rows.length,
        hash,
      ],
    },
  ]);
  const result = results[2][0].after_record as {
    hash: string;
    result: unknown;
  };
  if (result.hash !== hash)
    return error(
      "This import was already submitted with different choices. Reopen the import before making another submission.",
      409,
    );
  return json({ success: true, data: result.result });
}
