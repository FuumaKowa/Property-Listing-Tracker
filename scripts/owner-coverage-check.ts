import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { ownerListingsTableSql } from "../src/db/ownerListings";
import { handleOwnerListings } from "../functions/api/_owner-listings";

const pg = new PGlite();
const migration = "drizzle/0006_owner_selangor_coverage.sql";
const mappings = [
  [2, ["Shah Alam", "Setia Alam", "Alam Impian"]],
  [3, ["Klang", "Port Klang", "Kapar"]],
  [
    4,
    ["Petaling Jaya", "PJ", "Damansara", "Kota Damansara", "Sunway", "Ampang"],
  ],
  [
    5,
    [
      "Puchong",
      "Bandar Saujana Putra",
      "BSP",
      "Bandar Saujana Putera",
      "Cyberjaya",
      "Subang Jaya",
      "Seri Kembangan",
      "Bangi",
      "Kajang",
      "Semenyih",
      "Sepang",
    ],
  ],
  [6, ["Rawang", "Puncak Alam", "Sungai Buloh", "Selayang", "Bukit Beruntung"]],
] as const;
try {
  await pg.exec(
    "CREATE TABLE auth_users(id serial PRIMARY KEY,username text,display_name text,role text); INSERT INTO auth_users VALUES(1,'admin','Admin','admin'),(2,'shahril','Dr Shahril','user'),(3,'hakim','Hakim','user'),(4,'luqman','Luqman','user'),(5,'ikhwan','Ikhwan','user'),(6,'muz','Muz','user'); CREATE TABLE listings(id serial PRIMARY KEY,property text); INSERT INTO listings(property) VALUES('Normal listing unchanged');",
  );
  await pg.exec(ownerListingsTableSql);
  await pg.exec(readFileSync("drizzle/0000_n8n_ingestion.sql", "utf8"));
  await pg.exec(readFileSync("drizzle/0005_owner_workflow.sql", "utf8"));
  await pg.exec(
    "UPDATE owner_assignment_rules SET user_id=CASE key WHEN 'shahril' THEN 2 WHEN 'hakim' THEN 3 WHEN 'luqman' THEN 4 WHEN 'ikhwan' THEN 5 WHEN 'muz' THEN 6 END; INSERT INTO owner_listings(owner_name,no_tel,property_name,property_type,property_price,updated_by_name,location) VALUES('Existing owner','Not captured','Existing assignment','landed',100,'Original','Ampang'),('Not captured','Not captured','Existing unassigned','landed',100,'Original','Setia Alam'); UPDATE owner_listings SET assigned_agent_id=3,assigned_agent_name='Hakim',assigned_at=now()-interval '4 days',last_agent_activity_at=now()-interval '2 days',seeding_status='IFU2',version=4 WHERE id=1;",
  );
  const owners = (await pg.query("SELECT * FROM owner_listings ORDER BY id"))
    .rows;
  const normal = (await pg.query("SELECT * FROM listings")).rows;
  const events = (
    await pg.query(
      "SELECT * FROM owner_listing_events WHERE listing_id IS NOT NULL ORDER BY id",
    )
  ).rows;
  const accounts = (
    await pg.query(
      "SELECT key,user_id,agent_label FROM owner_assignment_rules ORDER BY key",
    )
  ).rows;
  const schemaSql =
    "SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position";
  const schema = (await pg.query(schemaSql)).rows;
  await pg.exec(readFileSync(migration, "utf8"));
  for (const [agent, areas] of mappings)
    for (const area of areas) {
      const result = await pg.query<{ id: number | null }>(
        "SELECT public.owner_agent_for_location($1) AS id",
        [area],
      );
      assert.equal(
        result.rows[0].id,
        agent,
        `${area} must route to the requested agent`,
      );
    }
  for (const [area, expected] of [
    ["SEtia   Alam, Selangor", 2],
    ["Bandar Saujana Putra (BSP), Selangor", 5],
    ["PJ / Ampang", 4],
    ["Kapar, Klang", 3],
    ["Setia Alam / Klang", null],
    ["Ampang / Kajang", null],
    ["Bangi / Bukit Beruntung", null],
    ["Kaparjaya", null],
    ["PJaya", null],
    ["BSPlantation", null],
    ["Selangor", null],
    ["Johor", null],
    ["", null],
  ] as const)
    assert.equal(
      (
        await pg.query<{ id: number | null }>(
          "SELECT public.owner_agent_for_location($1) AS id",
          [area],
        )
      ).rows[0].id,
      expected,
      area,
    );
  assert.deepEqual(
    (await pg.query("SELECT * FROM owner_listings ORDER BY id")).rows,
    owners,
    "Coverage must not change existing assignments, history clocks or property data",
  );
  assert.deepEqual((await pg.query("SELECT * FROM listings")).rows, normal);
  assert.deepEqual(
    (
      await pg.query(
        "SELECT * FROM owner_listing_events WHERE listing_id IS NOT NULL ORDER BY id",
      )
    ).rows,
    events,
  );
  assert.deepEqual(
    (
      await pg.query(
        "SELECT key,user_id,agent_label FROM owner_assignment_rules ORDER BY key",
      )
    ).rows,
    accounts,
  );
  assert.deepEqual(
    (await pg.query(schemaSql)).rows,
    schema,
    "This is a data-only migration",
  );
  const audit = (
    await pg.query<any>(
      "SELECT * FROM owner_listing_events WHERE action='assignment_rule' ORDER BY id",
    )
  ).rows;
  assert.equal(audit.length, 5);
  assert(
    audit.every(
      (e) =>
        e.before_record.areas.length < e.after_record.areas.length &&
        e.before_record.user_id === e.after_record.user_id,
    ),
  );
  await pg.exec(readFileSync(migration, "utf8"));
  assert.equal(
    (
      await pg.query<any>(
        "SELECT count(*)::int AS n FROM owner_listing_events WHERE action='assignment_rule'",
      )
    ).rows[0].n,
    5,
    "Reapplying the same coverage must not add duplicate audit events",
  );
  const services = {
    authenticate: async () => ({
      id: 1,
      username: "admin",
      displayName: "Admin",
      role: "admin" as const,
    }),
    connect: () => ({
      query: async (sql: string, params?: unknown[]) =>
        (await pg.query<Record<string, unknown>>(sql, params)).rows,
    }),
  };
  const call = (body: unknown, id?: string) =>
    handleOwnerListings(
      {
        env: { DATABASE_URL: "local-test" },
        params: id ? { id } : undefined,
        action: id ? "assignment" : undefined,
        request: new Request("https://test/api/owner-listings", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      },
      services,
    );
  const created = await call({
    ownerName: "Not captured",
    noTel: "Not captured",
    propertyName: "New import or manual listing",
    propertyType: "land",
    propertyPrice: "100",
    status: "Unlisted",
    location: "Bukit Beruntung",
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).data.assignedAgentId, 6);
  const reassigned = await call({ agentId: "auto", version: 4 }, "1");
  assert.equal(reassigned.status, 200);
  assert.equal(
    (await reassigned.json()).data.assignedAgentId,
    4,
    "An explicit assign-by-location action uses the new coverage",
  );
  await pg.query("DELETE FROM owner_assignment_rules WHERE key='muz'");
  await assert.rejects(
    () => pg.exec(readFileSync(migration, "utf8")),
    /Expected all five owner assignment rules/,
  );
  console.log(
    "PASS all 28 Selangor areas/aliases, boundary and ambiguity checks, new/explicit assignments, unchanged existing data/accounts/schema, and idempotent audit",
  );
} finally {
  await pg.close();
}
