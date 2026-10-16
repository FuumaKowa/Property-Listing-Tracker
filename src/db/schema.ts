import { sql, relations } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

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
  sourceOwnerListingId: integer('source_owner_listing_id'),
  id: serial('id').primaryKey(),
  property: text('property').notNull(),
  projectCategory: text('project_category').notNull().default('Project Marketing (PM)'),
  location: text('location').notNull(),
  tenure: text('tenure').notNull().default('-'),
  pm: text('pm').notNull().default('-'),
  version: integer('version').notNull().default(1),
  archivedAt: timestamp('archived_at', {withTimezone:true,mode:'string'}),
  archivedByName: text('archived_by_name'),
  createdByUserId: text('created_by_user_id'),
  createdByName: text('created_by_name'),
  ignoredDataWarnings: jsonb('ignored_data_warnings').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  isPriority: boolean('is_priority').notNull().default(false),
  negotiator: text('negotiator'),
  agent: text('agent'),
  noTel: text('no_tel'),
  availableUnits: text('available_units').notNull().default('-'),
  status: text('status').notNull().default('Active'),
  date: text('date').notNull().default(''),
  propertyGuruRepostDate: date('property_guru_repost_date', { mode: 'string' }),
  propertyGuruRepostMode: text('property_guru_repost_mode'),
  renewStatus: text('renew_status').notNull().default('Not Renewed'),
  notes: text('notes'),
  // Audit trail: who updated the listing and when
  updatedByUserId: text('updated_by_user_id'),
  updatedByName: text('updated_by_name').default('System'),
  updatedByEmail: text('updated_by_email'),
  lastUpdatedAt: timestamp('last_updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [uniqueIndex('listings_source_owner_listing_unique').on(table.sourceOwnerListingId),check('listings_repost_mode_check', sql`${table.propertyGuruRepostMode} IN ('Manual', 'Auto')`)]);

export const publicationChannels = pgTable('publication_channels', {
  id: serial('id').primaryKey(), name: text('name').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('publication_channels_name_unique').on(sql`lower(trim(${table.name}))`), check('publication_channels_name_check', sql`length(trim(${table.name})) BETWEEN 1 AND 80`)]);

export const listingPublications = pgTable('listing_publications', {
  version: integer('version').notNull().default(1),
  id: serial('id').primaryKey(),
  listingId: integer('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
  channelId: integer('channel_id').notNull().references(() => publicationChannels.id, { onDelete: 'restrict' }),
  url: text('url').notNull(), label: text('label'), notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('listing_publications_listing_idx').on(table.listingId),
  check('listing_publications_url_check', sql`length(${table.url}) BETWEEN 1 AND 2048`),
  check('listing_publications_label_check', sql`length(${table.label}) <= 120`),
  check('listing_publications_notes_check', sql`length(${table.notes}) <= 4000`)]);

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
export const ownerAssignmentRules = pgTable('owner_assignment_rules', {
  key:text('key').primaryKey(),agentLabel:text('agent_label').notNull(),areas:jsonb('areas').$type<string[]>().notNull(),userId:integer('user_id').references(()=>authUsers.id,{onDelete:'set null'}),
});
export const ownerListings = pgTable('owner_listings', {
  version:integer('version').notNull().default(1),
  assignedAgentId:integer('assigned_agent_id').references(()=>authUsers.id,{onDelete:'set null'}),assignedAgentName:text('assigned_agent_name'),
  assignedAt:timestamp('assigned_at',{withTimezone:true,mode:'string'}),
  lastAgentActivityAt:timestamp('last_agent_activity_at',{withTimezone:true,mode:'string'}),
  seedingStatus:text('seeding_status'),
  // OwnerHunter metadata is exclusive to Master Listing Owner.
  source: text('source'),
  externalListingId: text('listing_id'),
  transactionType: text('transaction_type'),
  location: text('location'),
  sourcePropertyType: text('source_property_type'),
  size: text('size'),
  bedrooms: integer('bedrooms'),
  bathrooms: numeric('bathrooms', { precision: 8, scale: 2 }),
  tenure: text('tenure'),
  advertiserType: text('advertiser_type'),
  ownerStatus: text('owner_status'),
  ownerScore: numeric('owner_score', { precision: 10, scale: 4 }),
  ownerEvidence: jsonb('owner_evidence'),
  listingDate: date('listing_date', { mode: 'string' }),
  discoveryChannel: text('discovery_channel'),
  foundAt: timestamp('found_at', { withTimezone: true, mode: 'string' }),
  id: serial('id').primaryKey(),
  ownerName: text('owner_name').notNull(),
  noTel: text('no_tel').notNull(),
  propertyName: text('property_name').notNull(),
  propertyLink: text('property_link').notNull().default(''),
  propertyType: text('property_type').notNull(),
  propertyPrice: numeric('property_price', { precision: 18, scale: 2 }),
  status: text('status').notNull().default('Unlisted'),
  updatedByName: text('updated_by_name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, table => [
  check('owner_listings_seeding_status_check',sql`${table.seedingStatus} IN ('IFU1','IFU2','IFU3','Contacted')`),
  check('owner_listings_owner_name_check', sql`length(trim(${table.ownerName})) BETWEEN 1 AND 200`),
  check('owner_listings_no_tel_check', sql`length(trim(${table.noTel})) BETWEEN 1 AND 50`),
  check('owner_listings_property_name_check', sql`length(trim(${table.propertyName})) BETWEEN 1 AND 300`),
  check('owner_listings_property_type_check', sql`${table.propertyType} IN ('landed', 'highrise', 'land', 'commercial', 'pending')`),
  check('owner_listings_property_price_check', sql`${table.propertyPrice} >= 0`),
  check('owner_listings_status_check', sql`${table.status} IN ('Listed', 'Unlisted', 'Rejected')`),
  uniqueIndex('owner_listings_source_listing_id_unique').on(table.source, table.externalListingId),
]);

export const ownerListingEvents=pgTable('owner_listing_events',{
 id:serial('id').primaryKey(),listingId:integer('listing_id').references(()=>ownerListings.id,{onDelete:'set null'}),action:text('action').notNull(),actorId:integer('actor_id'),actorName:text('actor_name').notNull(),note:text('note'),beforeRecord:jsonb('before_record'),afterRecord:jsonb('after_record'),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},table=>[index('owner_listing_events_listing_idx').on(table.listingId,table.id)]);

export const ownerSummaryReports=pgTable('owner_summary_reports',{
 id:text('id').primaryKey(),createdBy:integer('created_by').references(()=>authUsers.id,{onDelete:'set null'}),reportText:text('report_text').notNull(),entryCount:integer('entry_count').notNull(),outcomes:jsonb('outcomes').notNull().default(sql`'{}'::jsonb`),choices:jsonb('choices').notNull().default(sql`'{}'::jsonb`),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},table=>[index('owner_summary_reports_creator_idx').on(table.createdBy,table.updatedAt.desc()),check('owner_summary_reports_id_check',sql`${table.id} ~ '^[a-f0-9]{64}$'`),check('owner_summary_reports_report_text_check',sql`length(${table.reportText}) BETWEEN 1 AND 50000`),check('owner_summary_reports_entry_count_check',sql`${table.entryCount} BETWEEN 1 AND 100`)]);

export const listingReportReferences=pgTable('listing_report_references',{reference:text('reference').primaryKey(),listingId:integer('listing_id').notNull().references(()=>listings.id,{onDelete:'cascade'}),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow()},t=>[check('listing_report_references_reference_check',sql`length(${t.reference}) BETWEEN 1 AND 80`)]);

export const marketingWorkflows=pgTable('marketing_workflows',{
 id:text('id').primaryKey(),reference:text('reference').notNull().unique(),ownerListingId:integer('owner_listing_id').unique().references(()=>ownerListings.id,{onDelete:'set null'}),listingId:integer('listing_id').unique().references(()=>listings.id,{onDelete:'set null'}),version:integer('version').notNull().default(1),data:jsonb('data').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[check('marketing_workflow_reference_check',sql`length(${t.reference}) BETWEEN 1 AND 80`)]);
export const marketingWorkflowRoles=pgTable('marketing_workflow_roles',{
 userId:integer('user_id').primaryKey().references(()=>authUsers.id,{onDelete:'cascade'}),role:text('role').notNull(),
},t=>[check('marketing_workflow_roles_role_check',sql`${t.role} IN ('coordinator','producer','reviewer','publisher','viewer')`)]);
export const marketingWorkflowSessions=pgTable('marketing_workflow_sessions',{
 sessionHash:text('session_hash').primaryKey().references(()=>authSessions.sessionTokenHash,{onDelete:'cascade'}),effectiveUserId:integer('effective_user_id').notNull().references(()=>authUsers.id,{onDelete:'cascade'}),csrf:text('csrf').notNull(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
});
export const marketingWorkflowSwitches=pgTable('marketing_workflow_switches',{
 id:serial('id').primaryKey(),actualUserId:integer('actual_user_id').references(()=>authUsers.id,{onDelete:'set null'}),actualName:text('actual_name').notNull(),fromName:text('from_name').notNull(),toName:text('to_name').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
});
