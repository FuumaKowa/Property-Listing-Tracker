# Property details and publication channels

Click a normal property's address to open its detail card. Close with X, Escape, or a click outside. Details include contacts, legacy agent, notes, update attribution, renewal state, PropertyGuru dates, and all published ads. Master Listing Owner and OwnerHunter remain separate and unchanged.

Use **Publication channels** in the normal workspace header to add, rename, archive, or restore channels. Renames appear across all sheets. Archived channels keep their existing advertisements and cannot be selected for new ads. One property may have several links in the same channel. Use Add link or the edit icon in the property card to manage URL, label, and notes.

PropertyGuru repost dates and Manual/Auto mode only track a schedule. They do not publish or repost externally. Sold is stored as the existing `Sold Out` value, and Sold/Pending are protected from automatic expiry changes. Lister uses Negotiator with Agent as a fallback; both legacy contact values are preserved.

## Migration and release

Review `drizzle/0001_publication_channels.sql` before migrating production. It adds two nullable columns and a mode check to normal `listings`, creates `publication_channels` and `listing_publications`, adds uniqueness and lookup indexes, and seeds four channel names. No owner table, existing record values, or applied migration 0000 is modified. Advertisements reference normal listings only.

After explicit migration approval, use the direct production connection privately in `DATABASE_URL_UNPOOLED` and run `npm run db:migrate`. Do not use `db:push`. Verify the new columns/tables and preserved existing data before pushing the implementation to `main`; Cloudflare Pages then deploys using the existing GitHub workflow. No new secrets are required. Older deployed code remains compatible with the additive migration, making code rollback possible without dropping the new tables.

Before that production run, establish and verify a recoverable database backup or Neon recovery branch, record the migration state and original schema, and compare existing records after the migration. Preserve colleagues' concurrent edits; differences must be investigated rather than automatically restored from an older snapshot. Stop deployment on any unexplained loss. These production safeguards have not yet been executed.

## Local preview and verification

`npm run preview:integrated` serves the actual React app at http://127.0.0.1:4176 using synthetic records and a disposable PGlite database. It never imports the production database module or loads dotenv. Data disappears when the process stops. This preview script is not bundled into the production frontend or server.

Run `npm run lint`, `npm run build`, `npm run test:publications`, `npm run test:n8n`, and `npx tsx scripts/owner-api-check.ts`. Compile Pages Functions with `npx wrangler pages functions build functions --outdir .server/pages`. UI tests use the local synthetic preview only.

## Verification record — 2026-09-28

All commands above passed. The publication suite covers validation, the additive migration, preserved owner and normal listing data, API authentication and CRUD, Express/Pages parity, archived channels, lifecycle rules, CSV round trips, and slash-separated PIC filters. OwnerHunter regression tests also passed, including concurrent duplicate ingestion.

The migration preservation test compares every original field and row across fixtures for all six normal categories, owner listings including OwnerHunter metadata, audit logs, users, and sessions. It includes an unknown legacy JSON field, verifies original column types/defaults/nullability, and confirms the two added fields start as NULL. These are isolated local fixtures, not a production backup or production verification.

Browser checks used the actual React app with disposable sample data: property-card opening, link persistence, channel rename/archive/restore, archived-link preservation, failed inline/channel save draft retention and successful retries, X/Escape/outside close, and focus restoration. Phone (375), tablet (768), and desktop (1440) checks found no page-level horizontal overflow; the desktop table scrolls within its container. The mobile card stays within the viewport and scrolls internally.

Review findings resolved: failed inline saves and channel operations no longer discard drafts; joint PIC filtering is retained; absent repost mode is explicitly shown as unset; channel names appear in the compact publication summary on mobile as well as desktop. Browser checks were performed through the supported browser tool instead of adding a separate browser automation script. Database concurrency tests use local PostgreSQL-compatible PGlite fixtures; no claim is made that these exercise real concurrent Neon connections.

The feature was implemented in the existing feature checkout, with no parallel code writer. Production migration and deployment remain a separate gated release step. Do not interpret the passing local checks as evidence that production has been migrated or deployed.

## Approved production migration — 2026-09-28

After explicit user approval, recovery snapshot `before-publication-ui-2026-09-28` (`snap-empty-wildflower-b37o0jxf`) was created from production and verified in Neon's snapshot inventory. A fresh production-derived branch, `publication-ui-test-2026-09-28` (`br-ancient-hat-b3l8hnh1`), passed the exact migration and full existing-row/column/index comparisons.

Production then ran `npm run db:migrate` through its verified direct connection. Normal listings increased from 19 to 21 columns; owner listings stayed at 27. Every existing row's original-field fingerprint matched before/after across 96 normal listings, 6 owner listings, 9 auth users, 12 sessions, and the empty legacy users/audit tables. Original column definitions and indexes matched. Four channel names were seeded, advertisements started empty, and both applied migration hashes matched the local files. No existing record values were changed. Snapshot and test branch are retained; private verification fingerprints are stored under ignored `.server/` paths.

This records database readiness. GitHub push and live Cloudflare verification are reported separately after deployment.
