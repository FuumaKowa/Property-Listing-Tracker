# Listing history, conflict protection and archive

The application remains a single React webpage on the existing Cloudflare Pages project. Existing Pages Functions, Neon, domain and GitHub deployment are retained.

Normal listings and advertisement links now write actor-attributed before/after history to `listing_audit_logs` in the same SQL statement as each mutation. If logging fails, the mutation fails too. The authenticated session supplies the actor. Historical edits before this release cannot be recovered; assigned creator/PIC values remain unchanged.

Normal listing updates and archive/restore require the version returned by the last read. A successful mutation increments it. A stale version returns HTTP 409; a missing version returns 428. The frontend retains failed edit drafts and instructs users to refresh and review. Advertisement edits and removals independently require their advertisement version. Archived listings reject edits and advertisement mutations.

The normal listing DELETE route now archives; it never permanently deletes a row. Archived properties are excluded from the normal sheets and accessible through the Archived properties floating card, which supports search and restore. Details, publication links and audit history survive archive/restore. No permanent-delete UI or API is provided in this normal-listing workflow. Master Listing Owner and OwnerHunter remain unchanged.

Express and Pages share the normal-listing handler. The legacy database helper module is no longer used by Express listing routes. Existing browser tabs must refresh after deployment to receive version-aware code; older tabs fail safely instead of overwriting data.

## Additive migration

Run `npm run db:migrate` with the direct Neon connection in `DATABASE_URL_UNPOOLED` before deployment. Do not run `db:push`.

```sql
ALTER TABLE public.listings
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN archived_by_name text;
ALTER TABLE public.listing_publications ADD COLUMN version integer NOT NULL DEFAULT 1;
```

No existing fields, rows, indexes, creator assignments or owner tables are rewritten by this migration. Test against a fresh production-derived branch and retain recovery before applying it.

## Verification

Run `npm run test:safety`, `npm run test:ownership`, `npm run test:publications`, `npm run test:n8n`, `npx tsx scripts/owner-api-check.ts`, `npm run lint`, `npm run build`, and `npx wrangler pages functions build functions --outdir .server/pages`.

The disposable integrated preview exercises the real handlers. Verify archive/restore preserves links, audit history shows before/after values, and two tabs cannot overwrite each other's newer edits. The migration rollout compares hashes of every original public-table row and verifies original column definitions and indexes.
