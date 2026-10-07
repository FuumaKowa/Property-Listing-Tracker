import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { handleOwnerListings } from "../functions/api/_owner-listings";
import { createOwnerListingsRouter } from "../src/server/ownerListings";
import { ownerListingsTableSql } from "../src/db/ownerListings";

const pg = new PGlite();
let authenticated = true;
const services = {
  authenticate: async () =>
    authenticated
      ? {
          id: 1,
          username: "tester",
          displayName: "Tester",
          role: "user" as const,
        }
      : null,
  connect: () => ({
    query: async (sql: string, params?: unknown[]) =>
      (await pg.query<Record<string, any>>(sql, params)).rows,
  }),
  transact: async (
    _env: unknown,
    statements: { sql: string; params: unknown[] }[],
  ) =>
    pg.transaction(async (tx) => {
      const results: Record<string, any>[][] = [];
      for (const s of statements)
        results.push(
          (await tx.query<Record<string, any>>(s.sql, s.params)).rows,
        );
      return results;
    }),
};
const input = {
  ownerName: "Sample owner",
  noTel: "0123456789",
  propertyName: "Lake Apartment",
  propertyType: "Apartment",
  propertyPrice: "RM 300,000",
  location: "Shah Alam",
  propertyLink: "https://example.com/property/1",
  status: "",
};
const call = (body: unknown) =>
  handleOwnerListings(
    {
      action: "import",
      env: { DATABASE_URL: "local-test" },
      request: new Request("https://example.com/api/owner-listings/import", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    },
    services,
  );
const preview = (rows: unknown[]) => call({ mode: "preview", rows });
const commit = (rows: unknown[], choices: string[], importId = randomUUID()) =>
  call({ mode: "commit", rows, choices, importId });
const count = async () =>
  (await pg.query<any>("SELECT count(*)::int AS n FROM owner_listings")).rows[0]
    .n;
try {
  await pg.exec(
    "CREATE TABLE listings(id serial PRIMARY KEY,property text); INSERT INTO listings(property) VALUES('Normal listing stays unchanged'); CREATE TABLE auth_users(id serial PRIMARY KEY,username text,display_name text,role text); INSERT INTO auth_users VALUES(1,'tester','Tester','user'),(2,'shahril','Dr Shahril','user');",
  );
  await pg.exec(ownerListingsTableSql);
  await pg.exec(readFileSync("drizzle/0000_n8n_ingestion.sql", "utf8"));
  await pg.exec(readFileSync("drizzle/0005_owner_workflow.sql", "utf8"));
  await pg.exec(
    readFileSync("drizzle/0006_owner_selangor_coverage.sql", "utf8"),
  );
  await pg.exec(
    "UPDATE owner_assignment_rules SET user_id=2 WHERE key='shahril'; INSERT INTO owner_listings(owner_name,no_tel,property_name,property_type,property_price,status,updated_by_name,location,property_link,source,listing_id) VALUES('Keep owner','Not captured','Keep property','landed',450000,'Listed','Original','Klang','https://example.com/existing','mudah','123');",
  );
  const existing = (await pg.query("SELECT * FROM owner_listings")).rows;
  const normal = (await pg.query("SELECT * FROM listings")).rows;
  const history = (
    await pg.query("SELECT * FROM owner_listing_events ORDER BY id")
  ).rows;
  authenticated = false;
  assert.equal((await preview([input])).status, 401);
  authenticated = true;
  const p = await preview([
    input,
    input,
    { ...input, propertyLink: "https://example.com/existing" },
    { ...input, propertyType: "Unknown" },
  ]);
  assert.equal(
    p.status,
    200,
    "Owner import must preview rows before any inserts",
  );
  const rows = (await p.json()).data.rows;
  assert.deepEqual(
    rows.map((r: any) => r.kind),
    ["new", "duplicate", "duplicate", "invalid"],
  );
  assert.equal(rows[0].input.propertyPrice, "300000");
  assert.equal(rows[0].input.propertyType, "highrise");
  assert.equal(rows[1].matches[0].row, 1);
  assert.equal(rows[2].matches[0].id, 1);
  assert.equal(await count(), 1, "Preview cannot write records");

  const added = await commit(
    [input, input, { ...input, propertyLink: "https://example.com/existing" }],
    ["new", "skip", "skip"],
  );
  assert.equal(added.status, 200);
  assert.equal((await added.json()).data.added, 1);
  assert.equal(await count(), 2);
  const created = (
    await pg.query<any>(
      "SELECT * FROM owner_listings WHERE property_name='Lake Apartment'",
    )
  ).rows[0];
  assert.equal(created.assigned_agent_id, 2);
  assert.equal(created.no_tel, "0123456789");
  assert.equal(created.status, "Unlisted");
  assert.equal(
    created.source,
    null,
    "Spreadsheet rows are manual records; preserve the OwnerHunter unique identity",
  );
  const dup = await preview([
    { ...input, propertyLink: "HTTPS://EXAMPLE.COM/property/1#photos" },
    { ...input, propertyLink: "", noTel: "+60 12-345 6789" },
  ]);
  assert.deepEqual(
    (await dup.json()).data.rows.map((r: any) => r.kind),
    ["duplicate", "duplicate"],
  );
  assert.equal(
    (await (await commit([input], ["new"])).json()).data.added,
    0,
    "A duplicate arriving after preview must be skipped safely",
  );
  const importId = randomUUID();
  const forced = await commit([input], ["append"], importId);
  assert.equal(
    (await forced.json()).data.added,
    1,
    "Append anyway creates a separate record",
  );
  const retry = await commit([input], ["append"], importId);
  assert.equal(
    (await retry.json()).data.added,
    1,
    "A retry returns the original result",
  );
  assert.equal(
    await count(),
    3,
    "Retrying append anyway must not append twice",
  );
  assert.equal(
    (
      await commit(
        [{ ...input, propertyName: "Changed request" }],
        ["append"],
        importId,
      )
    ).status,
    409,
  );
  const secondFile = {
    ...input,
    propertyName: "New within file",
    propertyLink: "https://example.com/new-within",
  };
  assert.equal(
    (await (await commit([secondFile, secondFile], ["skip", "new"])).json())
      .data.added,
    1,
    "Skipping the first occurrence must not block a selected later row",
  );
  const missing = {
    ...input,
    propertyName: "Missing contact",
    propertyLink: "",
    ownerName: "",
    noTel: "",
    location: "",
    seedingStatus: "IFU2",
  };
  assert.equal((await commit([missing], ["new"])).status, 200);
  const sentinel = (
    await pg.query<any>(
      "SELECT * FROM owner_listings WHERE property_name='Missing contact'",
    )
  ).rows[0];
  assert.equal(sentinel.owner_name, "Not captured");
  assert.equal(sentinel.no_tel, "Not captured");
  assert.equal(sentinel.seeding_status, "IFU2");
  assert.equal(sentinel.assigned_agent_id, null);
  for (const change of [
    { propertyPrice: "RM 30,00" },
    { propertyPrice: "1e5" },
    { propertyPrice: "-1" },
    { propertyType: "Unknown" },
    { propertyName: "" },
    { status: "Active" },
    { propertyLink: "javascript:alert(1)" },
    { seedingStatus: "IFU4" },
  ]) {
    assert.equal(
      (await commit([{ ...input, ...change }], ["append"])).status,
      400,
    );
  }
  assert.equal((await preview(Array(201).fill(input))).status, 400);
  const beforeFailure = await count();
  await pg.exec(
    "ALTER TABLE owner_listing_events ADD CONSTRAINT reject_import CHECK(action<>'import') NOT VALID",
  );
  assert.equal(
    (
      await commit(
        [
          {
            ...input,
            propertyName: "Rollback",
            propertyLink: "https://example.com/rollback",
          },
        ],
        ["new"],
      )
    ).status,
    500,
  );
  assert.equal(
    await count(),
    beforeFailure,
    "Audit failure must roll back all imported rows",
  );
  await pg.exec(
    "ALTER TABLE owner_listing_events DROP CONSTRAINT reject_import",
  );
  const simultaneous = {
    ...input,
    propertyName: "Concurrent",
    propertyLink: "https://example.com/concurrent",
  };
  const outcomes = await Promise.all([
    commit([simultaneous], ["new"]),
    commit([simultaneous], ["new"]),
  ]);
  assert.equal(
    (await outcomes[0].json()).data.added +
      (await outcomes[1].json()).data.added,
    1,
  );
  assert.deepEqual(
    (await pg.query("SELECT * FROM owner_listings WHERE id=1")).rows,
    existing,
  );
  assert.deepEqual(
    (
      await pg.query(
        "SELECT * FROM owner_listing_events WHERE id <= $1 ORDER BY id",
        [history[history.length - 1].id],
      )
    ).rows,
    history,
  );
  assert.deepEqual((await pg.query("SELECT * FROM listings")).rows, normal);
  await assert.rejects(() =>
    pg.query(
      "INSERT INTO owner_listings(owner_name,no_tel,property_name,property_type,property_price,status,updated_by_name,source,listing_id) VALUES('X','X','X','land',1,'Unlisted','X','mudah','123')",
    ),
  );
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createOwnerListingsRouter(() => ({ DATABASE_URL: "test" }), services),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const r = await fetch(
      `http://127.0.0.1:${(server.address() as any).port}/api/owner-listings/import`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", rows: [input] }),
      },
    );
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), await (await preview([input])).json());
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  console.log(
    "PASS owner import: preview, normalization, skip/append, retries, concurrency, assignment, rollback, data preservation, auth and adapter parity",
  );
} finally {
  await pg.close();
}
