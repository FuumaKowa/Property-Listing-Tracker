# Connected workflow production implementation

> Execute inline in the existing checkout, preserving the reviewed local workflow, with a final independent code review. The user approved linking the workflow to owner/category records and deploying it live on 16 October 2026.

**Goal:** Run the reviewed marketing dashboard with real users, private media storage and transactional updates to existing owner/category listings without duplicates.

**Architecture:** Keep the pure workflow transitions and React interface. Add a production Pages handler using existing login sessions, a Neon-backed workflow store and private Neon Object Storage. Record links by stable owner/listing IDs and unique workflow reference. Apply workflow state, changed listing fields, publication links and audit records in one database transaction.

**Constraints:** Existing sheet structure, manual notes, prices, renewal dates, assignments and publication history survive. Do not copy local sample records to production. Only the actual SuperAdmin can switch workflow users. Workflow state never changes listing availability merely because material approval is pending. Blank inputs do not erase known listing details. Reference or category conflicts stop with a reviewable error. Explicit manual matching handles ambiguous candidates.

## Tasks

- [x] Add additive migration 0012 for workflow records, stable links, workflow user roles and session-scoped effective identity. Use actual Eypa/Luqman/Dr Shahril/Muz accounts. Keep previous application releases compatible.
- [x] Test and implement matching and synchronization in `src/server/workflow/database.ts` and `sync.ts`: exact references/source links, conservative property/contact matching, manual resolution, repeat/concurrent creation, archived row restoration, changed-fields-only updates, owner permission withdrawal, unchanged notes and publication deduplication. PGlite tests exercise rollback as well as success.
- [x] Add production `/api/workflow/*` handler with existing authentication, per-request real-user checks, CSRF, scoped switching, bounded validated uploads and authenticated Neon media retrieval. Test isolation, logout/revocation, role denials and stale writes.
- [x] Connect production UI: correct live labels and user names, visible owner/category links, manual match review, dashboard access after login, and workflow details in listing information. Preserve local sample preview behavior.
- [x] Run model/API/database regressions, browser workflow tests, TypeScript, production build and Pages compilation. Obtain independent review and fix actionable findings.
- [x] Test migration on an isolated Neon branch, establish a recovery checkpoint, apply additive migration and verify existing data unchanged. Configure private media storage. Commit and push through existing GitHub main deployment, then verify live dashboard/auth/storage and synchronization using isolated or rollback-only checks.

## Review focus

1. Reference already used by a report or a second workflow: reuse the correct row or stop; never create a second owner/category pair.
2. Same condominium with different owners/units, missing contacts, or conflicting reference/type: require a manual match rather than guessing.
3. Concurrent sheet edit followed by unrelated workflow approval: preserve the newer sheet value; update only explicitly changed workflow fields.
4. Owner withdrawn or category archived outside the workflow: publishing cannot silently reactivate it.
5. Failure after an upload or midway through synchronization: preserve database atomicity, remove only the new orphan object, and keep form input for retry.

## Deployment record

Implementation and independent review completed. Workflow regressions, owner/report regressions, TypeScript, production build, Pages Functions compilation and connected desktop/mobile handoffs pass. The new information panels and conflict navigation have browser coverage. Both review matching findings have regression cases. Real Neon WebSocket transactions and concurrent create requests pass on isolated branch `br-floral-union-b3uj2h1p`; migration preserved existing rows by whole-row hashes.

Ruling: the user declined R2 activation and selected Neon Object Storage. The private `listing-workflow-media` bucket exists on production and the isolated test branch. An encrypted `NEON_STORAGE_CONFIG` secret is configured in Pages production; no R2 subscription was activated. Signed upload/download, byte ranges and denied anonymous reads passed against the actual Neon test bucket. The adapter uses fetch with a real abort timeout. An accepted PUT with a lost response is included in orphan cleanup and has a regression test.

Ruling: the account has reached both snapshot and branch quotas. A proposed full local data export was rejected by automatic approval review and was not performed. The release instead records non-sensitive rollback metadata (timestamp, WAL LSN, migration hash and existing-row hashes) and applies only migration 0012 through Drizzle in one database transaction. Existing owner, listing, publication, reference and account tables are locked for the brief migration check; any preservation assertion failure rolls the transaction back. Code rollback uses the previous release and leaves the additive tables intact.

Application commit `4dd5fdb9f8091f612018c6c6b864e47becbb440a` was pushed to `main` and released as Pages deployment `8a6e50cc-65c9-422d-894c-fc46263ea504`. Production migration preserved 1,565 owners, 107 category listings, 117 publications, 3 reference mappings and 9 accounts by whole-row hashes and counts. The live `/workflow` dashboard and intake form load for the existing Daniel session; switching to Dr Shahril and returning to Daniel works without logging out. Anonymous API access returns 401. Storage upload/download/range/private-access checks and full synchronization checks passed in isolation. No fabricated production workflow was created.
