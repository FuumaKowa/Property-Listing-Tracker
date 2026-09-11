import { sql, relations } from 'drizzle-orm';
import { check, integer, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Legacy user profile table retained for existing data.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at').defaultNow(),
});

export const authUsers = pgTable('auth_users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at').defaultNow(),
});

export const authSessions = pgTable('auth_sessions', {
  id: serial('id').primaryKey(),
  sessionTokenHash: text('session_token_hash').notNull().unique(),
  userId: integer('user_id').references(() => authUsers.id, { onDelete: 'cascade' }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Property listings table with audit tracking
export const listings = pgTable('listings', {
  id: serial('id').primaryKey(),
  property: text('property').notNull(),
  projectCategory: text('project_category').notNull().default('Project Marketing (PM)'),
  location: text('location').notNull(),
  tenure: text('tenure').notNull().default('-'),
  pm: text('pm').notNull().default('-'),
  negotiator: text('negotiator'),
  agent: text('agent'),
  noTel: text('no_tel'),
  availableUnits: text('available_units').notNull().default('-'),
  status: text('status').notNull().default('Active'),
  date: text('date').notNull().default(''),
  renewStatus: text('renew_status').notNull().default('Not Renewed'),
  notes: text('notes'),
  // Audit trail: who updated the listing and when
  updatedByUserId: text('updated_by_user_id'),
  updatedByName: text('updated_by_name').default('System'),
  updatedByEmail: text('updated_by_email'),
  lastUpdatedAt: timestamp('last_updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Audit history log for detailed traceability of every edit
export const listingAuditLogs = pgTable('listing_audit_logs', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id')
    .references(() => listings.id, { onDelete: 'cascade' })
    .notNull(),
  action: text('action').notNull(), // 'create', 'update', 'status_change', 'renew_change'
  changedFields: text('changed_fields'), // JSON or summary of changes
  userName: text('user_name').notNull().default('System'),
  userEmail: text('user_email'),
  userUid: text('user_uid'),
  timestamp: timestamp('timestamp').defaultNow(),
});

export const listingsRelations = relations(listings, ({ many }) => ({
  auditLogs: many(listingAuditLogs),
}));

export const listingAuditLogsRelations = relations(listingAuditLogs, ({ one }) => ({
  listing: one(listings, {
    fields: [listingAuditLogs.listingId],
    references: [listings.id],
  }),
}));

// Owner records have no expiry or renewal lifecycle.
export const ownerListings = pgTable('owner_listings', {
  id: serial('id').primaryKey(),
  ownerName: text('owner_name').notNull(),
  noTel: text('no_tel').notNull(),
  propertyName: text('property_name').notNull(),
  propertyType: text('property_type').notNull(),
  propertyPrice: numeric('property_price', { precision: 18, scale: 2 }).notNull(),
  status: text('status').notNull().default('Unlisted'),
  updatedByName: text('updated_by_name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, table => [
  check('owner_listings_owner_name_check', sql`length(trim(${table.ownerName})) BETWEEN 1 AND 200`),
  check('owner_listings_no_tel_check', sql`length(trim(${table.noTel})) BETWEEN 1 AND 50`),
  check('owner_listings_property_name_check', sql`length(trim(${table.propertyName})) BETWEEN 1 AND 300`),
  check('owner_listings_property_type_check', sql`${table.propertyType} IN ('landed', 'highrise', 'land', 'commercial')`),
  check('owner_listings_property_price_check', sql`${table.propertyPrice} >= 0`),
  check('owner_listings_status_check', sql`${table.status} IN ('Listed', 'Unlisted')`),
]);
