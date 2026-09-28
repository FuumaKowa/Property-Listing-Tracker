# Property Details and Publication Channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the approved table, floating property card, and shared publication channel settings into the existing listing workspace.

**Architecture:** Keep normal listings and their existing data model, adding nullable repost tracking fields and relational publication tables. Share new authenticated request handlers between Cloudflare Pages Functions and the Express adapter. Reuse existing UI actions, authentication, and database connections.

**Tech Stack:** React, TypeScript, Vite, Express, Cloudflare Pages Functions, Drizzle, Neon PostgreSQL, PGlite tests.

**Spec:** `docs/superpowers/specs/2026-09-28-property-details-publication-channels-design.md`

## Global Constraints

- Master Listing Owner, its database table, and OwnerHunter ingestion remain unchanged.
- Existing sheet categories remain intact.
- Multiple advertisements in the same channel are supported.
- Close with the X button, an overlay click outside the card, or Escape.
- Removing a channel means archiving: existing links remain visible, but it is unavailable for new advertisements.
- Do not rewrite applied migration 0000.
- Preserve legacy Pending records and display their current value until explicitly changed.
- Automatic expiry and form date edits must never turn Sold into Active or Expired.
- New edits must not erase undisplayed legacy values.
- No production database changes before presenting and obtaining approval for the exact migration.
- User authorized implementation and GitHub push; main automatically deploys, so migration readiness must precede that push.

## Review Focus

- Two colleagues editing different parts of a property: publication CRUD must not send a replacement listing; normal PATCH sends changed fields only (Tasks 2–4).
- Channel archive races with adding an advertisement: database statement must reject newly archived channels atomically (Task 2).
- An old browser submits a listing without new fields: omitted fields remain unchanged; explicit null clears a repost date (Task 3).
- A modal closes while loading and another property opens: late responses cannot populate the wrong property (Task 4).
- Malicious links and HTML-like channel names: validate URL schemes/credentials, render text safely, and preserve input on save failures (Tasks 1, 4).

## Task 1: Add storage and shared contracts

**Files:** Modify `src/db/schema.ts`, `drizzle/meta/_journal.json`, `src/types.ts`; create `drizzle/0001_publication_channels.sql`, `src/publications.ts`, `scripts/publications-check.ts`.

**Interfaces:** Export `PublicationChannel { id: number; name: string; archivedAt: string | null }`, `ListingPublication { id: number; listingId: number; channelId: number; url: string; label: string | null; notes: string | null }`, and `PublicationInput { channelId: number; url: string; label?: string | null; notes?: string | null }`. Export `validateChannelName(value: unknown): string` and `validatePublicationInput(value: unknown): PublicationInput`, throwing a typed validation error for HTTP 400. Add optional nullable `propertyGuruRepostDate` and `propertyGuruRepostMode: 'Manual' | 'Auto' | null` to `PropertyListing`.

- [ ] Add failing assertions for trimmed case-insensitive channel uniqueness, invalid URL schemes/credentials, non-positive IDs, and nullable optional strings. Limits: channel name 80, URL 2,048, label 120, notes 4,000 characters. Assert `https://example.com/ad` is accepted and `javascript:alert(1)` and `https://user:pass@example.com` are rejected.
- [ ] Run `npx tsx scripts/publications-check.ts`; confirm tests fail before implementation.
- [ ] Add `publication_channels` (serial ID, name, archived_at, created_at, updated_at) with a unique index on lower(trim(name)). Add `listing_publications` (serial ID, listing_id FK to normal listings, channel_id FK with restrictive deletion, URL, nullable label/notes, timestamps). Index listing_id; deleting a normal listing cascades only its advertisements.
- [ ] Add nullable `property_guru_repost_date date` and `property_guru_repost_mode text` with Manual/Auto check to normal listings. Seed PropertyGuru, Mudah, Telegram, TikTok idempotently. Register the new migration without modifying 0000; inspect generated metadata so no unrelated schema change enters this migration.
- [ ] Implement validation and run the migration against a PGlite fixture matching the existing schema. Assert all existing listing and owner rows survive, owner schema is unchanged, duplicate channel names fail, and multiple advertisements per channel are allowed.
- [ ] Run `npx tsx scripts/publications-check.ts` and commit the storage/contracts task locally.

## Task 2: Authenticated publication APIs

**Files:** Create `functions/api/_publications.ts`, `functions/api/publication-channels.ts`, `functions/api/publication-channels/[id].ts`, `functions/api/listings/[id]/publications.ts`, `functions/api/listings/[id]/publications/[publicationId].ts`, `functions/api/publication-summaries.ts`, `src/server/publications/express.ts`; modify `server.ts`, `scripts/publications-check.ts`.

**Interfaces:** `handlePublications({ request, env, resource, listingId?, id? }): Promise<Response>` accepts resource `channels | publications | summaries`. Return `{ success: true, data }`; errors `{ success: false, error }`. Use existing `AuthEnv`, `getSessionUser`, and `getDb`. Export `createPublicationsRouter(envProvider): express.Router` as a thin adapter to the same handler.

- [ ] Add API tests with existing authenticated-session fixtures: unauthenticated 401; invalid input 400; missing rows 404; duplicate names 409; generic unexpected failure 500 without database detail.
- [ ] Add GET/POST channel collection, PATCH channel name/archive state, GET/POST per-listing publications, PATCH/DELETE one publication, and GET batched summaries via `listingIds` (at most 200 positive IDs). Summary rows contain listingId, count, and channel names; do not load all URLs for the grid.
- [ ] Bind every advertisement mutation to both publication ID and listing ID. Validate active channel in the INSERT/UPDATE statement to avoid archive races. Allow editing an existing ad on its same archived channel; disallow switching it to another archived channel.
- [ ] Mount Express routes ahead of the Vite fallback; preserve Pages cookie authentication through the shared handler. Do not reuse the unauthenticated normal Express route pattern for new APIs.
- [ ] Test shared handler and Express HTTP results for identical success/error shapes. Assert editing/deleting one link leaves another link and all normal listing fields unchanged. Assert channel rename/archive preserves existing links. Run `npx tsx scripts/publications-check.ts`; commit locally.

## Task 3: Listing compatibility and lifecycle

**Files:** Modify `functions/api/_db.ts`, `functions/api/listings.ts`, `functions/api/listings/[id].ts`, `src/db/listings.ts`, `src/utils/dateUtils.ts`, `src/components/Modals/ListingFormModal.tsx`, `src/utils/storage.ts`, `scripts/renewal-check.ts`.

**Interfaces:** Existing listing create/PATCH contracts gain Task 1's optional repost fields. `evaluateListingExpiry(listing, referenceDate)` retains its signature and preserves Sold Out and Pending records. Display label Sold maps to stored Sold Out.

- [ ] Add failing renewal tests: Sold Out with past/future expiry retains status; Pending is preserved; Want to be renew/In Progress remain intact after expiry. Test omitted repost properties preserve existing values and explicit null clears them.
- [ ] Extend both existing persistence paths and Pages SELECT projections with repost fields and shared validation. Preserve existing date parsing and do not invent expiry dates for historical rows.
- [ ] Update form loading, date-change handling, and submission so date recalculation cannot override Sold Out/Pending. Add labelled repost date and Manual/Auto fields; copy states these only track schedules.
- [ ] Display PIC from pm and Lister from negotiator, falling back to agent. Preserve separate legacy agent values in the detail/edit interface. Keep existing import/export compatibility and add optional repost columns without requiring them in old files.
- [ ] Run `npx tsx scripts/renewal-check.ts` and the API tests; commit locally.

## Task 4: Merge the approved UI

**Files:** Create `src/services/publications.ts`, `src/components/Modals/PropertyDetailsModal.tsx`, `src/components/Modals/PublicationChannelsModal.tsx`, `src/components/PublicationLinks.tsx`, `src/components/Modals/ModalFrame.tsx`; modify `src/App.tsx`, `src/components/Header.tsx`, `src/components/MasterPropertyGrid.tsx`, `src/index.css`; create `scripts/publications-ui-check.ts`.

**Interfaces:** Client methods `fetchPublicationChannels()`, `savePublicationChannel(id: number | null, input)`, `fetchListingPublications(listingId)`, `saveListingPublication(listingId, id: number | null, input)`, `deleteListingPublication(listingId, id)`, `fetchPublicationSummaries(listingIds)` throw on failed responses. Modal props use `listing`, `onClose`, `onEditListing`; channel settings have `onClose` and `onChannelsChanged`.

- [ ] Add UI checks using synthetic API responses, never production credentials/data. Cover opening a card by property address, retained audit/edit/select controls, channel CRUD, link add/edit/remove, filters, and legacy fields.
- [ ] Implement reusable labelled modal frame with focus trap/restoration, X/Escape/backdrop close, scroll locking, and mobile max-height. Ensure inside clicks do not close. Keep unfinished editing drafts protected when closing editing controls.
- [ ] Build read-only property overview, schedule, notes, update attribution, and legacy details in the card. Load links on open; abort/ignore stale requests. Include retry, loading, empty, and error states. Provide explicit link editing controls with validation and preserved failed-save input.
- [ ] Build shared channel settings with add, rename, archive, restore, and clear duplicate-name feedback. Refresh labels in summaries/cards after successful changes. Render user text with React escaping and external links with noopener/noreferrer.
- [ ] Merge table headers and styling from the approved prototype while retaining existing actions and filters. Keep a compact Published Ads column rather than one permanent column per channel. Show cards on narrow screens and a horizontally scrollable table on desktop. Keep the Master Listing Owner branch unchanged.
- [ ] Request summaries in chunks of at most 200 IDs, avoiding per-row requests. Update individual links independently; send only changed listing fields from edits to reduce concurrent overwrite risk.
- [ ] Verify X/outside/Escape, keyboard focus, malicious label text, failed save retention, quick switching between properties, multiple links in one channel, archive preservation, and layouts at 375, 768, and 1440 pixels. Run `npx tsx scripts/publications-ui-check.ts`; commit locally.

## Task 5: Review, migration readiness, and authorized push

**Files:** Modify `package.json` with `test:publications`; create `docs/publication-channels.md` describing migration, tracking-only schedules, and preserved data.

- [ ] Run `npm run lint`, `npm run build`, `npm run test:n8n`, `npx tsx scripts/renewal-check.ts`, `npx tsx scripts/owner-api-check.ts`, and the publication tests. Each must exit zero; resolve actual failures before repeating affected tests.
- [ ] Compile Pages Functions with `npx wrangler pages functions build functions --outdir .server/pages`. Confirm server output stays outside public dist and no secret is included in frontend output.
- [ ] Review the complete diff for authentication, accidental owner changes, secret exposure, migration drift, and stale full-record updates. Run `git diff --check` and the existing secret scanner against pending changes.
- [ ] Present exact additive migration SQL and isolated-database results to the user. Apply to production only after that migration approval; record owner schema/row preservation and normal listing data preservation without mistaking colleagues' concurrent changes for this migration's effects.
- [ ] Show the integrated UI locally with synthetic data before production deployment. The user has authorized the GitHub push; do not request duplicate push permission after prerequisites pass.
- [ ] Fetch origin, inspect incoming commits, integrate safely if needed, and push the reviewed implementation to main without rewriting history. Verify GitHub commit and Cloudflare build status. Report the commit, test results, migration status, and deployment result separately.

## Execution recommendation

Use native execution in this task: implement sequentially because schema, shared contracts, routes, and UI depend on one another. Keep local commits per task, then one final review before the authorized push. The written plan awaits user review before product implementation, as required by the writing-plans workflow.
