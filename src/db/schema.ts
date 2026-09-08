import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

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
