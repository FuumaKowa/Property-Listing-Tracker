# Connected workflow production implementation

> Execute inline in the existing checkout, preserving the reviewed local workflow, with a final independent code review. The user approved linking the workflow to owner/category records and deploying it live on 16 October 2026.

**Goal:** Run the reviewed marketing dashboard with real users, private media storage and transactional updates to existing owner/category listings without duplicates.

**Architecture:** Keep the pure workflow transitions and React interface. Add a production Pages handler using existing login sessions, a Neon-backed workflow store and private Cloudflare R2 media. Record links by stable owner/listing IDs and unique workflow reference. Apply workflow state, changed listing fields, publication links and audit records in one database transaction.

**Constraints:** Existing sheet structure, manual notes, prices, renewal dates, assignments and publication history survive. Do not copy local sample records to production. Only the actual SuperAdmin can switch workflow users. Workflow state never changes listing availability merely because material approval is pending. Blank inputs do not erase known listing details. Reference or category conflicts stop with a reviewable error. Explicit manual matching handles ambiguous candidates.

## Tasks

- [x] Add additive migration 0012 for workflow records, stable links, workflow user roles and session-scoped effective identity. Use actual Eypa/Luqman/Dr Shahril/Muz accounts. Keep previous application releases compatible.
- [x] Test and implement matching and synchronization in `src/server/workflow/database.ts` and `sync.ts`: exact references/source links, conservative property/contact matching, manual resolution, repeat/concurrent creation, archived row restoration, changed-fields-only updates, owner permission withdrawal, unchanged notes and publication deduplication. PGlite tests exercise rollback as well as success.
- [x] Add production `/api/workflow/*` handler with existing authentication, per-request real-user checks, CSRF, scoped switching, bounded validated uploads and authenticated R2 retrieval. Test isolation, logout/revocation, role denials and stale writes.
- [x] Connect production UI: correct live labels and user names, visible owner/category links, manual match review, dashboard access after login, and workflow details in listing information. Preserve local sample preview behavior.
- [x] Run model/API/database regressions, browser workflow tests, TypeScript, production build and Pages compilation. Obtain independent review and fix actionable findings.
- [ ] Test migration on an isolated Neon branch, establish a recovery checkpoint, apply additive migration and verify existing data unchanged. Configure private media binding. Commit and push through existing GitHub main deployment, then verify live dashboard/auth/storage and synchronization using isolated or rollback-only checks.

## Review focus

1. Reference already used by a report or a second workflow: reuse the correct row or stop; never create a second owner/category pair.
2. Same condominium with different owners/units, missing contacts, or conflicting reference/type: require a manual match rather than guessing.
3. Concurrent sheet edit followed by unrelated workflow approval: preserve the newer sheet value; update only explicitly changed workflow fields.
4. Owner withdrawn or category archived outside the workflow: publishing cannot silently reactivate it.
5. Failure after an upload or midway through synchronization: preserve database atomicity, remove only the new orphan object, and keep form input for retry.

## Deployment record

Implementation and independent review completed. Workflow regressions, owner/report regressions, TypeScript, production build, Pages Functions compilation and connected desktop/mobile handoffs pass. The new information panels and conflict navigation have browser coverage. Both review matching findings have regression cases. Real Neon WebSocket transactions and concurrent create requests pass on isolated branch `br-floral-union-b3uj2h1p`; migration preserved existing rows by whole-row hashes.

Production rollout awaits Cloudflare sign-in to provision/bind the private `WORKFLOW_MEDIA` bucket. The browser and CLI have no authenticated Cloudflare session. User sign-in was requested. No production migration or main-branch deployment has been performed. After sign-in: inspect the existing Pages project, configure private media, establish a Neon production recovery checkpoint, apply migration 0012 with before/after preservation checks, push through the existing main deployment, and verify live auth/storage.
