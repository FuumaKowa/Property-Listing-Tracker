import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {promotionFixture} from './owner-promotion-fixture';
import express from "express";
import { once } from "node:events";
import { drizzle } from "drizzle-orm/pglite";
import { createOwnerListingsRouter } from "../src/server/ownerListings";
import { handleN8nPages } from "../src/server/n8n/pages";
assert(
  existsSync("drizzle/0005_owner_workflow.sql"),
  "Owner workflow migration exists",
);
const { handleOwnerListings } =
  await import("../functions/api/_owner-listings");
const { OWNER_SEEDING_STAGES } = await import("../src/ownerListing");
const { ownerListingsTableSql } = await import("../src/db/ownerListings");
const pg = new PGlite();
await pg.exec("SET TIME ZONE 'UTC'");
await pg.exec(
  `CREATE TABLE auth_users(id serial PRIMARY KEY,username text,display_name text,role text);INSERT INTO auth_users(username,display_name,role) VALUES ('admin','Admin','admin'),('shahril','Dr Shahril','user'),('hakim','Hakim','user'),('luqman','Luqman','user'),('ikhwan','Ikhwan','user'),('muz','Muz','user');`,
);
await promotionFixture(pg);
await pg.exec("INSERT INTO listings(property) VALUES('Normal untouched')");
const normalRowsBefore=(await pg.query('SELECT * FROM listings')).rows;
await pg.exec(ownerListingsTableSql);
await pg.exec(readFileSync("drizzle/0000_n8n_ingestion.sql", "utf8"));
await pg.exec(
  `INSERT INTO owner_listings(owner_name,no_tel,property_name,property_type,property_price,updated_by_name) VALUES('Legacy','01','Original','land',100,'Legacy')`,
);
const before = (
  await pg.query<any>("SELECT to_jsonb(o) AS value FROM owner_listings o")
).rows[0].value;
const normalSchema = (
  await pg.query(
    "SELECT column_name,data_type FROM information_schema.columns WHERE table_name='listings' ORDER BY ordinal_position",
  )
).rows;
await pg.exec(readFileSync("drizzle/0005_owner_workflow.sql", "utf8"));
await pg.exec(readFileSync("drizzle/0006_owner_selangor_coverage.sql", "utf8"));
const beforeContactedMigration = (await pg.query("SELECT * FROM owner_listings ORDER BY id")).rows;
await pg.exec(readFileSync("drizzle/0007_owner_contacted_stage.sql", "utf8"));
assert.deepEqual((await pg.query("SELECT * FROM owner_listings ORDER BY id")).rows, beforeContactedMigration, "Contacted migration preserves existing owner rows");
const beforeInvalidLinkMigration = (await pg.query("SELECT * FROM owner_listings ORDER BY id")).rows;
await pg.exec(readFileSync("drizzle/0013_owner_invalid_link_stage.sql", "utf8"));
assert.deepEqual((await pg.query("SELECT * FROM owner_listings ORDER BY id")).rows, beforeInvalidLinkMigration, "Invalid link migration preserves existing owner rows");
assert(OWNER_SEEDING_STAGES.includes("Invalid link"), "Invalid link is an owner seeding stage");
let user: any = {
  id: 1,
  username: "admin",
  displayName: "Admin",
  role: "admin",
};
const services: any = {
  authenticate: async () => user,
  connect: () => ({
    query: async (sql: string, params: any[]) => {
      try {
        return (await pg.query(sql, params)).rows;
      } catch (e) {
        console.error((e as Error).message);
        throw e;
      }
    },
  }),
};
async function call(method: string, body?: any, id?: number, action?: string) {
  return handleOwnerListings(
    {
      env: { DATABASE_URL: "local" },
      params: id ? { id: String(id) } : undefined,
      action,
      request: new Request("https://test/api/owner-listings", {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    } as any,
    services,
  );
}
try {
  const legacy = (await (await call("GET")).json()).data[0];
  assert.equal(legacy.assignedAgentId, null);
  assert.equal(
    legacy.createdAt,
    new Date(before.created_at + "Z").toISOString(),
  );
  const settings = await (
    await call("GET", undefined, undefined, "settings")
  ).json();
  assert.equal(settings.data.rules.length, 5);
  assert.equal((await call("PATCH", null, undefined, "settings")).status, 400);
  for (const rule of settings.data.rules) {
    const id = ({ shahril: 2, hakim: 3, luqman: 4, ikhwan: 5, muz: 6 } as any)[
      rule.key
    ];
    assert.equal(
      (
        await call(
          "PATCH",
          { key: rule.key, userId: id },
          undefined,
          "settings",
        )
      ).status,
      200,
    );
  }
  const input = {
    ownerName: "Owner",
    noTel: "01",
    propertyName: "Synthetic property",
    propertyType: "highrise",
    propertyPrice: "300000",
    propertyLink: "https://example.com/original-post",
    status: "Unlisted",
  };
  for (const [location, id] of [
    ["Shah Alam", 2],
    ["Klang", 3],
    ["Damansara", 4],
    ["Kota Damansara", 4],
    ["Petaling Jaya", 4],
    ["Sunway", 4],
    ["Puchong", 5],
    ["Bandar Saujana Putera", 5],
    ["Cyberjaya", 5],
    ["Subang Jaya", 5],
    ["Rawang", 6],
    ["Puncak Alam", 6],
    ["Sungai Buloh", 6],
    ["Selayang", 6],
    ["", null],
    ["Johor", null],
    ["Klang / Shah Alam", null],
  ] as const) {
    const r = await call("POST", { ...input, location });
    assert.equal(r.status, 201, await r.clone().text());
    assert.equal((await r.json()).data.assignedAgentId, id, location);
  }
  const row = (
    await (
      await call("POST", { ...input, location: "Shah Alam, Selangor" })
    ).json()
  ).data;
  user = { id: 3, username: "hakim", displayName: "Hakim", role: "user" };
  assert.equal(
    (
      await call(
        "PATCH",
        { version: row.version, seedingStatus: "IFU1" },
        row.id,
        "activity",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "POST",
        { version: row.version, agentId: 3 },
        row.id,
        "assignment",
      )
    ).status,
    403,
  );
  user = {
    id: 2,
    username: "shahril",
    displayName: "Dr Shahril",
    role: "user",
  };
  let r = await call(
    "PATCH",
    { version: row.version, seedingStatus: "IFU1", note: "Called owner" },
    row.id,
    "activity",
  );
  assert.equal(r.status, 200, await r.clone().text());
  let next = (await r.json()).data;
  assert(next.lastAgentActivityAt);
  assert.equal(next.seedingStatus, "IFU1");
  assert.equal(
    (
      await call(
        "PATCH",
        { version: row.version, note: "Stale" },
        row.id,
        "activity",
      )
    ).status,
    409,
  );
  r = await call(
    "PATCH",
    { version: next.version, seedingStatus: "IFU1" },
    row.id,
    "activity",
  );
  assert.equal(r.status, 400, "No-op must not reset inactivity");
  user = { id: 1, username: "admin", displayName: "Admin", role: "admin" };
  r = await call(
    "POST",
    { version: next.version, agentId: 3 },
    row.id,
    "assignment",
  );
  assert.equal(r.status, 200);
  next = (await r.json()).data;
  assert.equal(next.assignedAgentId, 3);
  assert.equal(next.lastAgentActivityAt, null);
  assert.equal(next.seedingStatus, "IFU1");
  await pg.query(
    "UPDATE owner_listings SET assigned_at=now()-interval '73 hours' WHERE id=$1",
    [row.id],
  );
  next = (await (await call("GET")).json()).data.find(
    (v: any) => v.id === row.id,
  );
  assert.equal(next.needsAttention, true);
  r = await call(
    "PATCH",
    { version: next.version, status: "Rejected" },
    row.id,
    "activity",
  );
  assert.equal(r.status, 200);
  assert.equal((await r.json()).data.needsAttention, false);
  next = (await (await call("GET")).json()).data.find(
    (v: any) => v.id === row.id,
  );
  // General edits and another person's actions must never masquerade as agent activity.
  const beforeAdminActivity = next.lastAgentActivityAt;
  r = await call(
    "PATCH",
    { version: next.version, note: "Admin checking progress" },
    row.id,
    "activity",
  );
  assert.equal(r.status, 200);
  next = (await r.json()).data;
  assert.equal(next.lastAgentActivityAt, beforeAdminActivity);
  r = await call(
    "PATCH",
    { ...input, location: "Rawang", version: next.version },
    row.id,
  );
  assert.equal(r.status, 200);
  next = (await r.json()).data;
  assert.equal(
    next.assignedAgentId,
    3,
    "Editing location cannot silently override a manual assignment",
  );
  assert.equal(next.lastAgentActivityAt, beforeAdminActivity);
  assert.equal(
    (await call("PATCH", { note: "No version" }, row.id, "activity")).status,
    428,
  );
  assert.equal(
    (
      await call(
        "PATCH",
        { version: next.version, seedingStatus: "IFU4" },
        row.id,
        "activity",
      )
    ).status,
    400,
  );
  await pg.query(
    "UPDATE owner_listings SET assigned_at=now()-interval '71 hours' WHERE id=$1",
    [row.id],
  );
  assert.equal(
    (await (await call("GET")).json()).data.find((v: any) => v.id === row.id)
      .needsAttention,
    false,
  );
  await pg.query(
    "UPDATE owner_listings SET assigned_at=now()-interval '72 hours' WHERE id=$1",
    [row.id],
  );
  assert.equal(
    (await (await call("GET")).json()).data.find((v: any) => v.id === row.id)
      .needsAttention,
    true,
  );
  user = { id: 3, username: "hakim", displayName: "Hakim", role: "user" };
  const edits = await Promise.all([
    call(
      "PATCH",
      { version: next.version, note: "First save" },
      row.id,
      "activity",
    ),
    call(
      "PATCH",
      { version: next.version, note: "Second save" },
      row.id,
      "activity",
    ),
  ]);
  assert.deepEqual(
    edits.map((v) => v.status).sort(),
    [200, 409],
    "Only one concurrent save can win",
  );
  assert.equal(
    (await (await call("GET")).json()).data.find((v: any) => v.id === row.id)
      .needsAttention,
    false,
  );
  user = { id: 1, username: "admin", displayName: "Admin", role: "admin" };
  // Exercise the Express transport against the same Pages handler and data.
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createOwnerListingsRouter(() => ({ DATABASE_URL: "local" }), services),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  try {
    const base = `http://127.0.0.1:${address.port}/api`;
    for (const [path, id, action] of [
      ["owner-listings", undefined, undefined],
      ["owner-assignment-settings", undefined, "settings"],
      [`owner-listings/${row.id}/history`, row.id, "history"],
    ] as const) {
      const http = await fetch(`${base}/${path}`),
        pages = await call("GET", undefined, id, action);
      assert.equal(http.status, pages.status);
      assert.deepEqual(await http.json(), await pages.json());
    }
    const fresh = (await (await call("GET")).json()).data.find(
      (v: any) => v.id === row.id,
    );
    const reassigned = await fetch(
      `${base}/owner-listings/${row.id}/assignment`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: fresh.version, agentId: "auto" }),
      },
    );
    assert.equal(reassigned.status, 200);
    const assigned = (await reassigned.json()).data;
    assert.equal(assigned.assignedAgentId, 6);
    const contacted = await fetch(`${base}/owner-listings/${row.id}/activity`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:assigned.version,seedingStatus:"Contacted",note:"Owner contacted"})});
    assert.equal(contacted.status,200);
    assert.equal((await contacted.json()).data.seedingStatus,"Contacted");
    const reloaded = (await (await call("GET")).json()).data.find((v:any)=>v.id===row.id);
    assert.equal(reloaded.seedingStatus,"Contacted","Contacted persists through Express and Pages adapters");
    assert.equal((await pg.query<any>("SELECT seeding_status FROM owner_listings WHERE id=$1",[row.id])).rows[0].seeding_status,"Contacted");
    const invalidLink = await fetch(`${base}/owner-listings/${row.id}/activity`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:reloaded.version,seedingStatus:"Invalid link",note:"Original post link is broken"})});
    assert.equal(invalidLink.status,200,await invalidLink.clone().text());
    const invalidLinkRow = (await invalidLink.json()).data;
    assert.equal(invalidLinkRow.seedingStatus,"Invalid link");
    assert.equal(invalidLinkRow.propertyLink,"https://example.com/original-post","Marking a broken link as a stage must retain the original URL");
    assert.equal((await pg.query<any>("SELECT seeding_status,property_link FROM owner_listings WHERE id=$1",[row.id])).rows[0].seeding_status,"Invalid link");
    const contactedHistory = (await (await call("GET",undefined,row.id,"history")).json()).data;
    assert(contactedHistory.some((event:any)=>event.seedingStatus==="Contacted"&&event.note==="Owner contacted"));
    user = null;
    assert.equal((await fetch(`${base}/owner-listings`)).status, 401);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  user = { id: 1, username: "admin", displayName: "Admin", role: "admin" };
  // Existing n8n insertion receives the same assignment trigger; duplicates cannot reset it.
  const ingestDb = drizzle(pg),
    payload = {
      source: "Mudah",
      listing_id: "workflow-fixture",
      title: "Synthetic ingestion test",
      price: "RM 300,000",
      property_type: "Apartment",
      location: "Shah Alam",
      url: "https://example.com/workflow-fixture",
    };
  const ingest = () =>
    handleN8nPages(
      new Request("http://localhost/api/integrations/n8n/owner-listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "test-only",
        },
        body: JSON.stringify(payload),
      }),
      "test-only",
      (q) => ingestDb.execute(q),
    );
  const ingested = await ingest();
  assert.equal(ingested.status, 201);
  const ingestedId = (await ingested.json()).record.id;
  const snapshot = async () =>
    (await pg.query("SELECT * FROM owner_listings WHERE id=$1", [ingestedId]))
      .rows;
  const originalIngested = await snapshot();
  assert.equal((originalIngested[0] as any).assigned_agent_id, 2);
  const countEvents = (
    await pg.query(
      "SELECT count(*) FROM owner_listing_events WHERE listing_id=$1",
      [ingestedId],
    )
  ).rows;
  assert.equal((await ingest()).status, 200);
  assert.deepEqual(await snapshot(), originalIngested);
  assert.deepEqual(
    (
      await pg.query(
        "SELECT count(*) FROM owner_listing_events WHERE listing_id=$1",
        [ingestedId],
      )
    ).rows,
    countEvents,
  );
  const history = (
    await (await call("GET", undefined, row.id, "history")).json()
  ).data;
  assert(history.some((h: any) => h.action === "assignment"));
  assert(history.some((h: any) => h.note === "Called owner"));
  assert.deepEqual((await pg.query("SELECT * FROM listings")).rows, normalRowsBefore);
  assert.deepEqual(
    (
      await pg.query(
        "SELECT column_name,data_type FROM information_schema.columns WHERE table_name='listings' ORDER BY ordinal_position",
      )
    ).rows,
    normalSchema,
  );
  const after = (
    await pg.query<any>(
      "SELECT to_jsonb(o) AS value FROM owner_listings o WHERE id=1",
    )
  ).rows[0].value;
  for (const key of Object.keys(before))
    assert.deepEqual(after[key], before[key], key);
  await pg.query("DELETE FROM auth_users WHERE id=2");
  const orphan = (await (await call("GET")).json()).data.find(
    (v: any) => v.id === ingestedId,
  );
  assert.equal(orphan.assignedAgentId, null);
  assert.equal(orphan.needsAttention, false);
  assert.equal(
    orphan.assignedAgentName,
    "Dr Shahril",
    "Historical name retained",
  );
  user = null;
  assert.equal((await call("GET")).status, 401);
  assert.equal(
    (await call("GET", undefined, undefined, "settings")).status,
    401,
  );
  console.log(
    "PASS location rules, ambiguous/unmatched locations, role checks, activity and three-day alerts, reassignment, rejected status, conflict guard, history and existing data preservation",
  );
} finally {
  await pg.close();
}

