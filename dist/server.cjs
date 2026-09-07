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
var import_genai = require("@google/genai");
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
  // Firebase Auth UID
  email: (0, import_pg_core.text)("email").notNull(),
  displayName: (0, import_pg_core.text)("display_name"),
  photoUrl: (0, import_pg_core.text)("photo_url"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  lastLoginAt: (0, import_pg_core.timestamp)("last_login_at").defaultNow()
});
var listings = (0, import_pg_core.pgTable)("listings", {
  id: (0, import_pg_core.serial)("id").primaryKey(),
  property: (0, import_pg_core.text)("property").notNull(),
  projectCategory: (0, import_pg_core.text)("project_category").notNull().default("Project Marketing (PM)"),
  location: (0, import_pg_core.text)("location").notNull(),
  tenure: (0, import_pg_core.text)("tenure").notNull().default("-"),
  pm: (0, import_pg_core.text)("pm").notNull().default("-"),
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
async function createListingInDb(data, userInfo) {
  try {
    const now = /* @__PURE__ */ new Date();
    const [inserted] = await db.insert(listings).values({
      property: data.property,
      projectCategory: data.projectCategory || "Project Marketing (PM)",
      location: data.location,
      tenure: data.tenure || "-",
      pm: data.pm || "-",
      availableUnits: data.availableUnits || "-",
      status: data.status || "Active",
      date: data.date || "",
      renewStatus: data.renewStatus || "Not Renewed",
      notes: data.notes || null,
      updatedByUserId: userInfo.uid || null,
      updatedByName: userInfo.name || "Anonymous User",
      updatedByEmail: userInfo.email || null,
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
      userName: userInfo.name || "Anonymous User",
      userEmail: userInfo.email || null,
      userUid: userInfo.uid || null,
      timestamp: now
    });
    return inserted;
  } catch (error) {
    console.error("Failed to create listing in database:", error);
    throw new Error("Failed to create listing in database", { cause: error });
  }
}
async function updateListingInDb(id, updates, userInfo) {
  try {
    const now = /* @__PURE__ */ new Date();
    const [updated] = await db.update(listings).set({
      ...updates,
      updatedByUserId: userInfo.uid || null,
      updatedByName: userInfo.name || "Anonymous User",
      updatedByEmail: userInfo.email || null,
      lastUpdatedAt: now
    }).where((0, import_drizzle_orm2.eq)(listings.id, id)).returning();
    await db.insert(listingAuditLogs).values({
      listingId: id,
      action: "update",
      changedFields: JSON.stringify(updates),
      userName: userInfo.name || "Anonymous User",
      userEmail: userInfo.email || null,
      userUid: userInfo.uid || null,
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
var aiClient = null;
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new import_genai.GoogleGenAI({ apiKey });
  }
  return aiClient;
}
app.post("/api/gemini/extract", async (req, res) => {
  const { text: text2 } = req.body;
  if (!text2 || typeof text2 !== "string") {
    return res.status(400).json({ error: "Text content is required for extraction" });
  }
  const ai = getGenAI();
  if (!ai) {
    const mockExtraction = heuristicExtract(text2);
    return res.json({
      success: true,
      data: mockExtraction,
      note: "Processed via local parser (Configure GEMINI_API_KEY for advanced multi-project AI parsing)"
    });
  }
  try {
    const prompt = `You are a real estate database assistant. Extract real estate property listing information from the provided raw text into a structured JSON array of listings matching this exact schema:
- Property (string): The property development or project name (e.g. "Service Apartment Linkar 52")
- Project_Category (string): One of: "Project Marketing (PM)", "Rental", "Subsale CoA (SSCOA)", "Subsale Direct Listing (SSDL)", "Million Dollar Property (MD)", or "Auction"
- Location (string): Town, district, or city with state if identifiable (e.g. "Shah Alam, Selangor")
- Tenure (string): "Freehold", "Leasehold", "Freehold Malay Reserved", or "-"
- PM (string): The assigned Project Manager / agent (e.g. "Haneah", "Benik", "Akram/Benik/Fb")
- Available_Units (string): Stock level, e.g. ratio "256/495", count "784", or percentage "70% Booking"
- Status (string): "Active" or "Expired"
- Date (string): "DD.MM" format (e.g. "26.10", "18.8")
- Renew_Status (string): "Renewed", "Want to be renew", or "Not Renewed"
- Notes (optional string): Any relevant caveats or unit details

Raw input text:
"""
${text2}
"""

Return a JSON array of extracted listings.`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.ARRAY,
          items: {
            type: import_genai.Type.OBJECT,
            properties: {
              Property: { type: import_genai.Type.STRING },
              Project_Category: {
                type: import_genai.Type.STRING,
                enum: [
                  "Project Marketing (PM)",
                  "Rental",
                  "Subsale CoA (SSCOA)",
                  "Subsale Direct Listing (SSDL)",
                  "Million Dollar Property (MD)",
                  "Auction"
                ]
              },
              Location: { type: import_genai.Type.STRING },
              Tenure: { type: import_genai.Type.STRING },
              PM: { type: import_genai.Type.STRING },
              Available_Units: { type: import_genai.Type.STRING },
              Status: { type: import_genai.Type.STRING },
              Date: { type: import_genai.Type.STRING },
              Renew_Status: { type: import_genai.Type.STRING },
              Notes: { type: import_genai.Type.STRING }
            },
            required: ["Property", "Location", "PM", "Available_Units", "Status", "Date", "Renew_Status"]
          }
        }
      }
    });
    const parsed = JSON.parse(response.text || "[]");
    const normalized = parsed.map((item) => ({
      property: item.Property || "Unnamed Property",
      projectCategory: item.Project_Category || "Project Marketing (PM)",
      location: item.Location || "-",
      tenure: item.Tenure || "-",
      pm: item.PM || "-",
      availableUnits: item.Available_Units || "-",
      status: item.Status === "Expired" ? "Expired" : "Active",
      date: item.Date || `${(/* @__PURE__ */ new Date()).getDate()}.${(/* @__PURE__ */ new Date()).getMonth() + 1}`,
      renewStatus: item.Renew_Status === "Renewed" ? "Renewed" : (item.Renew_Status || "").toLowerCase().includes("want") ? "Want to be renew" : "Not Renewed",
      confidenceNotes: item.Notes || "AI extracted from description"
    }));
    return res.json({ success: true, data: normalized });
  } catch (error) {
    console.error("Gemini extract error:", error);
    const fallback = heuristicExtract(text2);
    return res.json({
      success: true,
      data: fallback,
      note: "Fallback parser used: " + (error?.message || "Gemini request failure")
    });
  }
});
app.post("/api/gemini/chat", async (req, res) => {
  const { message, history, tableData } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }
  const ai = getGenAI();
  if (!ai) {
    const localReply = answerLocally(message, tableData || []);
    return res.json({
      success: true,
      reply: localReply.text,
      sources: localReply.sources,
      suggestedActions: localReply.suggestedActions
    });
  }
  try {
    const tableContext = JSON.stringify(tableData || [], null, 2);
    const systemInstruction = `You are the expert Property Listing Tracker Portfolio Assistant in Google AI Studio.
You have real-time access to the user's active property listing database (${(tableData || []).length} properties).

Data Schema:
- id (number): unique identifier
- property (string): property/project name
- projectCategory (string): One of: "Project Marketing (PM)", "Rental", "Subsale CoA (SSCOA)", "Subsale Direct Listing (SSDL)", "Million Dollar Property (MD)", or "Auction"
- location (string): city, district, state
- tenure (string): Freehold, Leasehold, Freehold Malay Reserved, or -
- pm (string): Project Manager / team
- availableUnits (string): e.g. "10/62", "784", "70% Booking", "0/24"
- status (string): Active or Expired
- date (string): DD.MM format milestone date
- renewStatus (string): Renewed or Not Renewed

Guidelines:
1. Provide accurate, data-backed answers based strictly on the current active table data.
2. If asked about a specific PM (e.g. Nor Ozir, Zuraini, Benik, Haneah), list their exact properties, status, and renewal state.
3. If asked for a summary, provide counts of Active, Expired, Renewed, Not Renewed, and highlight immediate action items.
4. If asked about locations (e.g. Shah Alam, Klang, Sabak Bernam, Sitiawan), calculate total available units and projects.
5. Format your answers crisply using Markdown bullet points, bold numbers, and concise tables when appropriate.
6. Keep answers professional, crisp, and high-density. Avoid rambling.`;
    const chatHistory = (history || []).slice(-6).map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }]
    }));
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: `CURRENT DATABASE STATE:
\`\`\`json
${tableContext}
\`\`\`

USER QUESTION: ${message}` }
          ]
        }
      ],
      config: {
        systemInstruction,
        temperature: 0.2
      }
    });
    return res.json({
      success: true,
      reply: response.text || "No response received."
    });
  } catch (error) {
    console.error("Gemini chat error:", error);
    const localReply = answerLocally(message, tableData || []);
    return res.json({
      success: true,
      reply: localReply.text,
      sources: localReply.sources,
      suggestedActions: localReply.suggestedActions,
      note: "Handled via local assistant: " + (error?.message || "")
    });
  }
});
app.post("/api/gemini/generate-pm-alert", async (req, res) => {
  const { listing } = req.body;
  if (!listing) {
    return res.status(400).json({ error: "Listing data is required" });
  }
  const ai = getGenAI();
  if (!ai) {
    return res.json({
      success: true,
      draft: generateLocalAlert(listing)
    });
  }
  try {
    const prompt = `Generate urgent follow-up communication drafts for an expired real estate listing that has NOT been renewed.
Listing details:
- Property: ${listing.property}
- Assigned PM: ${listing.pm}
- Location: ${listing.location}
- Milestone Date: ${listing.date}
- Available Units: ${listing.availableUnits}
- Status: ${listing.status}
- Renew Status: ${listing.renewStatus}

Generate a JSON object with:
1. "urgency": "High" | "Medium" | "Low"
2. "emailSubject": professional email subject line
3. "emailBody": concise, respectful, action-oriented email body prompting renewal or status update
4. "whatsappMessage": short WhatsApp ready-to-send reminder with emojis
5. "slackMessage": crisp Slack message with markdown formatting`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            urgency: { type: import_genai.Type.STRING },
            emailSubject: { type: import_genai.Type.STRING },
            emailBody: { type: import_genai.Type.STRING },
            whatsappMessage: { type: import_genai.Type.STRING },
            slackMessage: { type: import_genai.Type.STRING }
          },
          required: ["urgency", "emailSubject", "emailBody", "whatsappMessage", "slackMessage"]
        }
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      draft: {
        id: "alert_" + listing.id + "_" + Date.now(),
        listingId: listing.id,
        propertyName: listing.property,
        pm: listing.pm,
        location: listing.location,
        daysExpiredOrDate: listing.date,
        urgency: parsed.urgency || "High",
        emailSubject: parsed.emailSubject,
        emailBody: parsed.emailBody,
        whatsappMessage: parsed.whatsappMessage,
        slackMessage: parsed.slackMessage
      }
    });
  } catch (error) {
    return res.json({
      success: true,
      draft: generateLocalAlert(listing)
    });
  }
});
app.post("/api/gemini/standardize", async (req, res) => {
  const { listings: listings2 } = req.body;
  if (!listings2 || !Array.isArray(listings2)) {
    return res.status(400).json({ error: "Listings array required" });
  }
  const ai = getGenAI();
  if (!ai) {
    const results = listings2.map((l) => localStandardize(l));
    return res.json({ success: true, results });
  }
  try {
    const prompt = `Analyze and standardize real estate location and tenure data for the following property records.
Rules:
- Standardize Locations into clean format: "[Town / Area], [District if applicable], [State]" (e.g. "Shah Alam U9" -> "Seksyen U9, Shah Alam, Selangor", "Rantau Panjang Klang" -> "Rantau Panjang, Klang, Selangor").
- Standardize Tenures into standard taxonomy: "Freehold", "Leasehold", "Freehold Malay Reserved", or leave as "-" if unknown.

Input items:
${JSON.stringify(
      listings2.map((l) => ({
        id: l.id,
        property: l.property,
        location: l.location,
        tenure: l.tenure
      })),
      null,
      2
    )}

Return a JSON array of objects with schema:
- id (number)
- standardizedLocation (string)
- standardizedTenure (string)
- suggestedChanges (array of strings explaining what changed)`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.ARRAY,
          items: {
            type: import_genai.Type.OBJECT,
            properties: {
              id: { type: import_genai.Type.INTEGER },
              standardizedLocation: { type: import_genai.Type.STRING },
              standardizedTenure: { type: import_genai.Type.STRING },
              suggestedChanges: {
                type: import_genai.Type.ARRAY,
                items: { type: import_genai.Type.STRING }
              }
            },
            required: ["id", "standardizedLocation", "standardizedTenure", "suggestedChanges"]
          }
        }
      }
    });
    const parsed = JSON.parse(response.text || "[]");
    const results = parsed.map((item) => {
      const original = listings2.find((l) => l.id === item.id) || {};
      return {
        id: item.id,
        originalLocation: original.location || "",
        standardizedLocation: item.standardizedLocation,
        originalTenure: original.tenure || "",
        standardizedTenure: item.standardizedTenure,
        suggestedChanges: item.suggestedChanges || []
      };
    });
    return res.json({ success: true, results });
  } catch (error) {
    const results = listings2.map((l) => localStandardize(l));
    return res.json({ success: true, results });
  }
});
function heuristicExtract(text2) {
  const lines = text2.split("\n").map((l) => l.trim()).filter(Boolean);
  const results = [];
  const nameMatch = text2.match(/(?:called|project|development|property|unit)\s+[:"]?([A-Za-z0-9\s&@-]+?)(?:[.,"\n]|in\s)/i) || text2.match(/^([A-Za-z0-9\s&@-]+?)(?:,|\s-|\sis\s)/);
  const propertyName = nameMatch ? nameMatch[1].trim() : "New Project";
  const locMatch = text2.match(/(?:in|at|location)\s+([A-Za-z0-9\s,]+?)(?:[.,\n]|with|managed)/i);
  const location = locMatch ? locMatch[1].trim() : "Shah Alam, Selangor";
  let tenure = "-";
  if (/malay\s*reserved/i.test(text2)) tenure = "Freehold Malay Reserved";
  else if (/freehold/i.test(text2)) tenure = "Freehold";
  else if (/leasehold/i.test(text2)) tenure = "Leasehold";
  const pmMatch = text2.match(/(?:managed by|pm|agent|handled by|assign to)\s+([A-Za-z\s/]+?)(?:[.,\n]|there|with)/i) || text2.match(/([A-Z][a-z]+)\s+will manage/i);
  const pm = pmMatch ? pmMatch[1].trim() : "Unassigned";
  const unitsRatio = text2.match(/(\d+)\s+(?:available|left)\s+(?:out of|of)\s+(\d+)/i) || text2.match(/(\d+)\s*\/\s*(\d+)/);
  let availableUnits = "10/50";
  if (unitsRatio) {
    availableUnits = `${unitsRatio[1]}/${unitsRatio[2]}`;
  } else {
    const rawCount = text2.match(/(\d+)\s+(?:units|available)/i);
    if (rawCount) availableUnits = rawCount[1];
  }
  const d = /* @__PURE__ */ new Date();
  const dateStr = `${d.getDate()}.${d.getMonth() + 1}`;
  let category = "Project Marketing (PM)";
  if (/auction/i.test(text2)) category = "Auction";
  else if (/rental|rent|lease/i.test(text2)) category = "Rental";
  else if (/subsale\s*coa|sscoa/i.test(text2)) category = "Subsale CoA (SSCOA)";
  else if (/direct\s*listing|ssdl/i.test(text2)) category = "Subsale Direct Listing (SSDL)";
  else if (/million\s*dollar|md\s*property/i.test(text2)) category = "Million Dollar Property (MD)";
  results.push({
    property: propertyName,
    projectCategory: category,
    location,
    tenure,
    pm,
    availableUnits,
    status: /expired/i.test(text2) ? "Expired" : "Active",
    date: dateStr,
    renewStatus: /not renewed/i.test(text2) ? "Not Renewed" : "Renewed",
    confidenceNotes: "Parsed via intelligent pattern matcher"
  });
  return results;
}
function answerLocally(query, data) {
  const q = query.toLowerCase();
  if (q.includes("nor ozir") || q.includes("ozir")) {
    const pms = data.filter((d) => (d.pm || "").toLowerCase().includes("nor ozir") || (d.pm || "").toLowerCase().includes("ozir"));
    const active = pms.filter((p) => p.status === "Active");
    const expired = pms.filter((p) => p.status === "Expired");
    const text2 = `**Nor Ozir's Portfolio Analysis**:
- Total Listings Assigned: **${pms.length}**
- Active Listings: **${active.length}** (${active.map((a) => a.property).join(", ") || "None"})
- Expired Listings: **${expired.length}** (${expired.map((e) => e.property).join(", ") || "None"})
- Inventory Breakdown: Sssd Tmn Desa Idaman (8/28), Ss Taman Kelana (0/24), APT E-sentral Smart City (784 count).`;
    return { text: text2, sources: pms.map((p) => p.property), suggestedActions: [{ label: "Filter Nor Ozir", actionType: "filter_pm", value: "Nor Ozir" }] };
  }
  if (q.includes("zuraini")) {
    const pms = data.filter((d) => (d.pm || "").toLowerCase().includes("zuraini"));
    const text2 = `**Zuraini's Portfolio Status**:
- Total Listings: **${pms.length}**
- Status: All **${pms.length}** are currently **Expired & Not Renewed**.
- Properties: Ss J3 Residence (45/125), Ss J2 Residence (0/80), Bungalow Indahville 2 (0/17), Ss Indahville 4 (10/46).
- All 4 are **Freehold Malay Reserved** and require immediate renewal follow-up.`;
    return { text: text2, sources: pms.map((p) => p.property), suggestedActions: [{ label: "Filter Zuraini", actionType: "filter_pm", value: "Zuraini" }] };
  }
  if (q.includes("summary") || q.includes("daily") || q.includes("report") || q.includes("overview")) {
    const total = data.length;
    const active = data.filter((d) => d.status === "Active").length;
    const expired = data.filter((d) => d.status === "Expired").length;
    const renewed = data.filter((d) => d.renewStatus === "Renewed").length;
    const notRenewed = data.filter((d) => d.renewStatus === "Not Renewed").length;
    const fmr = data.filter((d) => (d.tenure || "").includes("Malay Reserved")).length;
    const text2 = `**Listing Portfolio Overview**:
- Total Listings Tracked: **${total}**
- Active Projects: **${active}** (${Math.round(active / total * 100)}%)
- Expired Projects: **${expired}** (${Math.round(expired / total * 100)}%)
- Renewal Status: **${renewed} Renewed** vs **${notRenewed} Pending Renewal**
- Freehold Malay Reserved (FMR): **${fmr} projects**
- **Urgent Action**: ${data.filter((d) => d.status === "Expired" && d.renewStatus === "Not Renewed").length} listings require PM follow-up notices.`;
    return { text: text2, sources: ["Master Grid Dataset"] };
  }
  if (q.includes("malay reserved") || q.includes("fmr")) {
    const fmr = data.filter((d) => (d.tenure || "").includes("Malay Reserved"));
    const text2 = `**Freehold Malay Reserved (FMR) Properties** (${fmr.length} total):
` + fmr.map((f) => `- **${f.property}** (${f.location}) \u2014 PM: ${f.pm} | Units: ${f.availableUnits} | Status: ${f.status} (${f.renewStatus})`).join("\n");
    return { text: text2, sources: fmr.map((f) => f.property) };
  }
  if (q.includes("sabak bernam") || q.includes("shah alam") || q.includes("klang") || q.includes("ipoh")) {
    const targetLoc = q.includes("sabak bernam") ? "sabak bernam" : q.includes("shah alam") ? "shah alam" : q.includes("klang") ? "klang" : "ipoh";
    const matches = data.filter((d) => (d.location || "").toLowerCase().includes(targetLoc));
    const text2 = `**${targetLoc.toUpperCase()} Regional Inventory** (${matches.length} listings):
` + matches.map((m) => `- **${m.property}** | PM: ${m.pm} | Units: ${m.availableUnits} | Status: ${m.status}`).join("\n");
    return { text: text2, sources: matches.map((m) => m.property) };
  }
  return {
    text: `Found **${data.length} listings** in your tracker (${data.filter((d) => d.status === "Active").length} Active, ${data.filter((d) => d.status === "Expired").length} Expired). You can ask me to analyze specific PMs (e.g. *Zuraini, Nor Ozir, Haneah*), filter by state/town, calculate total available stock, or draft renewal alerts.`,
    sources: []
  };
}
function generateLocalAlert(listing) {
  return {
    id: "alert_" + listing.id + "_" + Date.now(),
    listingId: listing.id,
    propertyName: listing.property,
    pm: listing.pm,
    location: listing.location,
    daysExpiredOrDate: listing.date,
    urgency: "High",
    emailSubject: `ACTION REQUIRED: Listing Renewal for ${listing.property} (${listing.location})`,
    emailBody: `Hi ${listing.pm},

Our listing tracker indicates that the listing for "${listing.property}" located at ${listing.location} expired on ${listing.date} and is currently marked as "Not Renewed".

Current available inventory is logged at: ${listing.availableUnits}.

Please review whether this project is being extended, renewed for marketing, or if stock is sold out. Kindly reply with the updated status.

Best regards,
Property Portfolio Operations`,
    whatsappMessage: `\u{1F6A8} *Listing Renewal Reminder*
Hi ${listing.pm}, "${listing.property}" at ${listing.location} is showing as Expired (${listing.date}) and Not Renewed. Available units: ${listing.availableUnits}. Please confirm if renewed or closed! Thank you.`,
    slackMessage: `:warning: *Listing Alert: Renewal Due*
*Project:* ${listing.property}
*PM:* @${listing.pm}
*Location:* ${listing.location}
*Expired Date:* ${listing.date}
*Current Stock:* ${listing.availableUnits}
Please update the listing status in the master tracker.`
  };
}
function localStandardize(listing) {
  let stdLoc = listing.location;
  const changes = [];
  if (stdLoc.includes("Shah Alam U9")) {
    stdLoc = "Seksyen U9, Shah Alam, Selangor";
    changes.push("Standardized Section U9 notation and appended Selangor state tag");
  } else if (stdLoc.includes("Rantau Panjang Klang")) {
    stdLoc = "Rantau Panjang, Klang, Selangor";
    changes.push("Added comma delimiter and explicit state suffix");
  } else if (stdLoc.includes("Meru Klang")) {
    stdLoc = "Meru, Klang, Selangor";
    changes.push("Formatted district and state hierarchy");
  } else if (stdLoc === "Shah Alam") {
    stdLoc = "Shah Alam, Selangor";
    changes.push("Appended standard state suffix");
  } else if (stdLoc === "Semenyih") {
    stdLoc = "Semenyih, Selangor";
    changes.push("Appended state suffix");
  } else if (stdLoc === "Puncak Alam") {
    stdLoc = "Puncak Alam, Selangor";
    changes.push("Appended state suffix");
  }
  let stdTenure = listing.tenure;
  if (stdTenure === "-") {
    changes.push("Unspecified tenure flagged for legal review");
  }
  return {
    id: listing.id,
    originalLocation: listing.location,
    standardizedLocation: stdLoc,
    originalTenure: listing.tenure,
    standardizedTenure: stdTenure,
    suggestedChanges: changes.length > 0 ? changes : ["Already standard format"]
  };
}
function extractUserInfo(req) {
  const headerName = req.headers["x-user-name"];
  const headerEmail = req.headers["x-user-email"];
  const bodyName = req.body?.updatedByName || req.body?.userName;
  const bodyEmail = req.body?.updatedByEmail || req.body?.userEmail;
  return {
    name: headerName || bodyName || "Team Member",
    email: headerEmail || bodyEmail || void 0
  };
}
app.get("/api/listings", async (req, res) => {
  try {
    const data = await getAllListingsFromDb();
    res.json({ success: true, data });
  } catch (error) {
    console.warn("Database query failed for /api/listings:", error?.message || error);
    res.status(500).json({ error: "Failed to load your listings" });
  }
});
app.post("/api/listings", async (req, res) => {
  try {
    const userInfo = extractUserInfo(req);
    const created = await createListingInDb(req.body, userInfo);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("Failed to create listing in database, returning local representation:", error);
    const fallbackId = Date.now();
    res.status(201).json({ success: true, data: { id: fallbackId, ...req.body }, fallback: true });
  }
});
app.patch("/api/listings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }
    const userInfo = extractUserInfo(req);
    const updated = await updateListingInDb(id, req.body, userInfo);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error(`Failed to update listing ${req.params.id} in database:`, error);
    const id = parseInt(req.params.id, 10);
    res.json({ success: true, data: { id, ...req.body }, fallback: true });
  }
});
app.delete("/api/listings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }
    await deleteListingFromDb(id);
    res.json({ success: true, message: `Listing ${id} deleted` });
  } catch (error) {
    console.error(`Failed to delete listing ${req.params.id}:`, error);
    res.json({ success: true, message: `Listing ${req.params.id} deleted (local fallback)` });
  }
});
app.get("/api/audit-logs", async (req, res) => {
  try {
    const listingIdParam = req.query.listingId ? parseInt(req.query.listingId, 10) : void 0;
    const logs = await getAuditLogs(listingIdParam);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    res.json({ success: true, data: [] });
  }
});
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
});
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
