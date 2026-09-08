"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc2) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc2 = __getOwnPropDesc(from, key)) || desc2.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var import_vite = require("vite");

// src/db/index.ts
var import_config = require("dotenv/config");
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pg = require("pg");

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  authSessions: () => authSessions,
  authUsers: () => authUsers,
  listingAuditLogs: () => listingAuditLogs,
  listingAuditLogsRelations: () => listingAuditLogsRelations,
  listings: () => listings,
  listingsRelations: () => listingsRelations,
  users: () => users
});
var import_drizzle_orm = require("drizzle-orm");
var import_pg_core = require("drizzle-orm/pg-core");
var users = (0, import_pg_core.pgTable)("users", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  uid: (0, import_pg_core.text)("uid").notNull().unique(),
  email: (0, import_pg_core.text)("email").notNull(),
  displayName: (0, import_pg_core.text)("display_name"),
  photoUrl: (0, import_pg_core.text)("photo_url"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  lastLoginAt: (0, import_pg_core.timestamp)("last_login_at").defaultNow()
});
var authUsers = (0, import_pg_core.pgTable)("auth_users", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  username: (0, import_pg_core.text)("username").notNull().unique(),
  passwordHash: (0, import_pg_core.text)("password_hash").notNull(),
  role: (0, import_pg_core.text)("role").notNull().default("user"),
  displayName: (0, import_pg_core.text)("display_name"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  lastLoginAt: (0, import_pg_core.timestamp)("last_login_at").defaultNow()
});
var authSessions = (0, import_pg_core.pgTable)("auth_sessions", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  sessionTokenHash: (0, import_pg_core.text)("session_token_hash").notNull().unique(),
  userId: (0, import_pg_core.integer)("user_id").references(() => authUsers.id, { onDelete: "cascade" }).notNull(),
  expiresAt: (0, import_pg_core.timestamp)("expires_at").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var listings = (0, import_pg_core.pgTable)("listings", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  property: (0, import_pg_core.text)("property").notNull(),
  projectCategory: (0, import_pg_core.text)("project_category").notNull().default("Project Marketing (PM)"),
  location: (0, import_pg_core.text)("location").notNull(),
  tenure: (0, import_pg_core.text)("tenure").notNull().default("-"),
  pm: (0, import_pg_core.text)("pm").notNull().default("-"),
  negotiator: (0, import_pg_core.text)("negotiator"),
  agent: (0, import_pg_core.text)("agent"),
  noTel: (0, import_pg_core.text)("no_tel"),
  availableUnits: (0, import_pg_core.text)("available_units").notNull().default("-"),
  status: (0, import_pg_core.text)("status").notNull().default("Active"),
  date: (0, import_pg_core.text)("date").notNull().default(""),
  renewStatus: (0, import_pg_core.text)("renew_status").notNull().default("Not Renewed"),
  notes: (0, import_pg_core.text)("notes"),
  // Audit trail: who updated the listing and when
  updatedByUserId: (0, import_pg_core.text)("updated_by_user_id"),
  updatedByName: (0, import_pg_core.text)("updated_by_name").default("System"),
  updatedByEmail: (0, import_pg_core.text)("updated_by_email"),
  lastUpdatedAt: (0, import_pg_core.timestamp)("last_updated_at").defaultNow(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var listingAuditLogs = (0, import_pg_core.pgTable)("listing_audit_logs", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  listingId: (0, import_pg_core.integer)("listing_id").references(() => listings.id, { onDelete: "cascade" }).notNull(),
  action: (0, import_pg_core.text)("action").notNull(),
  // 'create', 'update', 'status_change', 'renew_change'
  changedFields: (0, import_pg_core.text)("changed_fields"),
  // JSON or summary of changes
  userName: (0, import_pg_core.text)("user_name").notNull().default("System"),
  userEmail: (0, import_pg_core.text)("user_email"),
  userUid: (0, import_pg_core.text)("user_uid"),
  timestamp: (0, import_pg_core.timestamp)("timestamp").defaultNow()
});
var listingsRelations = (0, import_drizzle_orm.relations)(listings, ({ many }) => ({
  auditLogs: many(listingAuditLogs)
}));
var listingAuditLogsRelations = (0, import_drizzle_orm.relations)(listingAuditLogs, ({ one }) => ({
  listing: one(listings, {
    fields: [listingAuditLogs.listingId],
    references: [listings.id]
  })
}));

// src/db/index.ts
var connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or NEON_DATABASE_URL must be set. Add your Neon connection string to the environment.");
}
var createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new import_pg.Pool({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 15e3,
      ssl: { rejectUnauthorized: false }
    });
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = (0, import_node_postgres.drizzle)(pool, { schema: schema_exports });

// src/db/listings.ts
var import_drizzle_orm2 = require("drizzle-orm");

// src/data/initialData.ts
var INITIAL_PROPERTY_LISTINGS = [
  {
    id: 1,
    property: "Ss Taman Kenanga",
    projectCategory: "Project Marketing (PM)",
    location: "Sabak Bernam, Selangor",
    tenure: "Freehold",
    pm: "Benik",
    availableUnits: "10/62",
    status: "Active",
    date: "23.10",
    renewStatus: "Renewed"
  },
  {
    id: 2,
    property: "Ds First Vista",
    projectCategory: "Project Marketing (PM)",
    location: "Sabak Bernam, Selangor",
    tenure: "Freehold",
    pm: "Akram/Benik/Fb",
    availableUnits: "18/34",
    status: "Active",
    date: "25.10",
    renewStatus: "Renewed"
  },
  {
    id: 3,
    property: "Ss Taman Dorani Sejahtera",
    projectCategory: "Subsale Direct Listing (SSDL)",
    location: "Sungai Besar, Selangor",
    tenure: "Freehold",
    pm: "Sariza",
    availableUnits: "16/41",
    status: "Active",
    date: "25.10",
    renewStatus: "Renewed"
  },
  {
    id: 4,
    property: "Galaxy Avenue Shoplot",
    projectCategory: "Rental",
    location: "Puncak Alam",
    tenure: "-",
    pm: "Shazni",
    availableUnits: "59/204",
    status: "Active",
    date: "28.8",
    renewStatus: "Want to be renew"
  },
  {
    id: 5,
    property: "Ds Taman Satria",
    projectCategory: "Subsale CoA (SSCOA)",
    location: "Teluk Panglima Garang, Selangor",
    tenure: "Leasehold",
    pm: "Akram",
    availableUnits: "5/22",
    status: "Expired",
    date: "18.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 6,
    property: "Bungalow Desa Bukit Kerayong",
    projectCategory: "Million Dollar Property (MD)",
    location: "Puncak Alam, Selangor",
    tenure: "Leasehold",
    pm: "Benik",
    availableUnits: "7/242",
    status: "Expired",
    date: "18.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 7,
    property: "Semi D Taman Dato Harun",
    projectCategory: "Auction",
    location: "Pulau Indah, Klang, Selangor",
    tenure: "Freehold",
    pm: "Akram",
    availableUnits: "5/28",
    status: "Expired",
    date: "18.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 8,
    property: "APT E-sentral Smart City",
    projectCategory: "Project Marketing (PM)",
    location: "Subang Bestari, Shah Alam, Selangor",
    tenure: "-",
    pm: "Nor Ozir",
    availableUnits: "784",
    status: "Expired",
    date: "18.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 9,
    property: "Astana",
    projectCategory: "Subsale CoA (SSCOA)",
    location: "Chemor, Perak",
    tenure: "-",
    pm: "Fahmy Osman",
    availableUnits: "12/70",
    status: "Expired",
    date: "18.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 10,
    property: "Santorini Apartment @ Botani",
    projectCategory: "Rental",
    location: "Ipoh, Perak",
    tenure: "-",
    pm: "Fahmy Osman",
    availableUnits: "94",
    status: "Expired",
    date: "21.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 11,
    property: "Ss J3 Residence, Jenderam Lestari",
    projectCategory: "Project Marketing (PM)",
    location: "Jenderam Hilir, Dengkil, Selangor",
    tenure: "Freehold Malay Reserved",
    pm: "Zuraini",
    availableUnits: "45/125",
    status: "Expired",
    date: "21.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 12,
    property: "Ss J2 Residence, Jenderam Lestari",
    projectCategory: "Project Marketing (PM)",
    location: "Jenderam Hilir, Dengkil, Selangor",
    tenure: "Freehold Malay Reserved",
    pm: "Zuraini",
    availableUnits: "0/80",
    status: "Expired",
    date: "21.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 13,
    property: "Bungalow Indahville 2",
    projectCategory: "Million Dollar Property (MD)",
    location: "Pulau Indah, Klang, Selangor",
    tenure: "Freehold Malay Reserved",
    pm: "Zuraini",
    availableUnits: "0/17",
    status: "Expired",
    date: "22.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 14,
    property: "Ss Indahville 4",
    projectCategory: "Subsale Direct Listing (SSDL)",
    location: "Pulau Indah, Klang, Selangor",
    tenure: "Freehold Malay Reserved",
    pm: "Zuraini",
    availableUnits: "10/46",
    status: "Expired",
    date: "22.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 15,
    property: "Double Storey Pavonia",
    projectCategory: "Project Marketing (PM)",
    location: "Bukit Bandaraya, Shah Alam, Selangor",
    tenure: "-",
    pm: "Haneah",
    availableUnits: "19/130",
    status: "Active",
    date: "26.10",
    renewStatus: "Renewed"
  },
  {
    id: 16,
    property: "Bungalow Amber 1 & 2",
    projectCategory: "Million Dollar Property (MD)",
    location: "Subang Bestari, Shah Alam, Selangor",
    tenure: "-",
    pm: "Haneah",
    availableUnits: "5/15",
    status: "Active",
    date: "26.10",
    renewStatus: "Renewed"
  },
  {
    id: 17,
    property: "Service Apartment Linkar 52",
    projectCategory: "Project Marketing (PM)",
    location: "Shah Alam",
    tenure: "-",
    pm: "Haneah",
    availableUnits: "256/495",
    status: "Active",
    date: "26.10",
    renewStatus: "Renewed"
  },
  {
    id: 18,
    property: "Dsth Tamanhijrah",
    projectCategory: "Auction",
    location: "Rantau Panjang Klang",
    tenure: "-",
    pm: "Dsn / Iza",
    availableUnits: "3",
    status: "Active",
    date: "24.8",
    renewStatus: "Want to be renew"
  },
  {
    id: 19,
    property: "Residensi Perintis Satu",
    projectCategory: "Project Marketing (PM)",
    location: "Seksyen 29, Shah Alam",
    tenure: "-",
    pm: "Che Mad",
    availableUnits: "31/40",
    status: "Active",
    date: "24.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 20,
    property: "Residensi Bayu Timur Condo",
    projectCategory: "Rental",
    location: "Seksyen 32, Shah Alam",
    tenure: "-",
    pm: "Che Mad",
    availableUnits: "518",
    status: "Active",
    date: "24.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 21,
    property: "Sssd Tmn Desa Idaman",
    projectCategory: "Subsale CoA (SSCOA)",
    location: "Olak Lempit Banting",
    tenure: "Freehold Malay Reserved",
    pm: "Nor Ozir",
    availableUnits: "8/28",
    status: "Active",
    date: "24.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 22,
    property: "Ss Taman Kelana",
    projectCategory: "Auction",
    location: "Kapar",
    tenure: "Leasehold",
    pm: "Nor Ozir",
    availableUnits: "0/24",
    status: "Active",
    date: "24.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 23,
    property: "Double Storey Tmn Orchid",
    projectCategory: "Subsale Direct Listing (SSDL)",
    location: "Meru Klang",
    tenure: "-",
    pm: "Sariza",
    availableUnits: "7/24",
    status: "Active",
    date: "24.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 24,
    property: "Double Storey Terrace Tenera",
    projectCategory: "Project Marketing (PM)",
    location: "Semenyih",
    tenure: "-",
    pm: "SAM Lai",
    availableUnits: "17/26",
    status: "Active",
    date: "24.8",
    renewStatus: "Not Renewed"
  },
  {
    id: 25,
    property: "Rsku",
    projectCategory: "Project Marketing (PM)",
    location: "Shah Alam U9",
    tenure: "-",
    pm: "Dsn / Ikhwan",
    availableUnits: "70% Booking",
    status: "Active",
    date: "26.10",
    renewStatus: "Renewed"
  }
];

// src/db/listings.ts
async function getAllListingsFromDb() {
  try {
    let all = await db.select().from(listings).orderBy(listings.id);
    if (all.length === 0 && INITIAL_PROPERTY_LISTINGS.length > 0) {
      console.log("Seeding initial property listings to Cloud SQL...");
      const toInsert = INITIAL_PROPERTY_LISTINGS.map((item) => ({
        property: item.property,
        projectCategory: item.projectCategory || "Project Marketing (PM)",
        location: item.location,
        tenure: item.tenure,
        pm: item.pm,
        availableUnits: item.availableUnits,
        status: item.status,
        date: item.date,
        renewStatus: item.renewStatus,
        notes: item.notes || null,
        updatedByName: "System Seed",
        updatedByEmail: "system@internal",
        lastUpdatedAt: /* @__PURE__ */ new Date()
      }));
      await db.insert(listings).values(toInsert);
      all = await db.select().from(listings).orderBy(listings.id);
    }
    return all;
  } catch (error) {
    console.error("Database query for listings failed:", error);
    throw new Error("Database query for listings failed", { cause: error });
  }
}
async function createListingInDb(data, userInfo2) {
  try {
    const now = /* @__PURE__ */ new Date();
    const [inserted] = await db.insert(listings).values({
      property: data.property,
      projectCategory: data.projectCategory || "Project Marketing (PM)",
      location: data.location,
      tenure: data.tenure || "-",
      pm: data.pm || "-",
      negotiator: data.negotiator || null,
      agent: data.agent || null,
      noTel: data.noTel || null,
      availableUnits: data.availableUnits || "-",
      status: data.status || "Active",
      date: data.date || "",
      renewStatus: data.renewStatus || "Not Renewed",
      notes: data.notes || null,
      updatedByUserId: userInfo2.uid || null,
      updatedByName: userInfo2.name || "Anonymous User",
      updatedByEmail: userInfo2.email || null,
      lastUpdatedAt: now
    }).returning();
    await db.insert(listingAuditLogs).values({
      listingId: inserted.id,
      action: "create",
      changedFields: JSON.stringify({
        property: data.property,
        projectCategory: data.projectCategory || "Project Marketing (PM)",
        location: data.location,
        status: data.status
      }),
      userName: userInfo2.name || "Anonymous User",
      userEmail: userInfo2.email || null,
      userUid: userInfo2.uid || null,
      timestamp: now
    });
    return inserted;
  } catch (error) {
    console.error("Failed to create listing in database:", error);
    throw new Error("Failed to create listing in database", { cause: error });
  }
}
async function updateListingInDb(id, updates, userInfo2) {
  try {
    const now = /* @__PURE__ */ new Date();
    const [updated] = await db.update(listings).set({
      ...updates,
      updatedByUserId: userInfo2.uid || null,
      updatedByName: userInfo2.name || "Anonymous User",
      updatedByEmail: userInfo2.email || null,
      lastUpdatedAt: now
    }).where((0, import_drizzle_orm2.eq)(listings.id, id)).returning();
    await db.insert(listingAuditLogs).values({
      listingId: id,
      action: "update",
      changedFields: JSON.stringify(updates),
      userName: userInfo2.name || "Anonymous User",
      userEmail: userInfo2.email || null,
      userUid: userInfo2.uid || null,
      timestamp: now
    });
    return updated;
  } catch (error) {
    console.error(`Failed to update listing #${id}:`, error);
    throw new Error(`Failed to update listing #${id}`, { cause: error });
  }
}
async function deleteListingFromDb(id) {
  try {
    await db.delete(listings).where((0, import_drizzle_orm2.eq)(listings.id, id));
    return { success: true };
  } catch (error) {
    console.error(`Failed to delete listing #${id}:`, error);
    throw new Error(`Failed to delete listing #${id}`, { cause: error });
  }
}
async function getAuditLogs(listingId) {
  try {
    if (listingId) {
      return await db.select().from(listingAuditLogs).where((0, import_drizzle_orm2.eq)(listingAuditLogs.listingId, listingId)).orderBy((0, import_drizzle_orm2.desc)(listingAuditLogs.timestamp)).limit(100);
    }
    return await db.select().from(listingAuditLogs).orderBy((0, import_drizzle_orm2.desc)(listingAuditLogs.timestamp)).limit(200);
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    throw new Error("Failed to fetch audit logs", { cause: error });
  }
}

// server.ts
var import_meta = {};
import_dotenv.default.config();
var __filename = (0, import_url.fileURLToPath)(import_meta.url);
var __dirname = import_path.default.dirname(__filename);
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "10mb" }));
function userInfo(req) {
  return {
    name: req.headers["x-user-name"] || req.body?.updatedByName || "Team Member",
    email: req.headers["x-user-email"] || req.body?.updatedByEmail || void 0
  };
}
app.get("/api/listings", async (_req, res) => {
  try {
    res.json({ success: true, data: await getAllListingsFromDb() });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load listings" });
  }
});
app.post("/api/listings", async (req, res) => {
  try {
    res.status(201).json({ success: true, data: await createListingInDb(req.body, userInfo(req)) });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to create listing" });
  }
});
app.patch("/api/listings/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid listing ID" });
    res.json({ success: true, data: await updateListingInDb(id, req.body, userInfo(req)) });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update listing" });
  }
});
app.delete("/api/listings/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid listing ID" });
    res.json(await deleteListingFromDb(id));
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete listing" });
  }
});
app.get("/api/audit-logs", async (req, res) => {
  try {
    const listingId = req.query.listingId ? Number(req.query.listingId) : void 0;
    res.json({ success: true, data: await getAuditLogs(listingId) });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load audit logs" });
  }
});
app.get("/api/health", (_req, res) => res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() }));
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (_req, res) => res.sendFile(import_path.default.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}
void startServer();
//# sourceMappingURL=server.cjs.map
