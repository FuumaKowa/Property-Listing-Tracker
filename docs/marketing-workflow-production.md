# Connected marketing workflow

The `/workflow` dashboard uses the existing tracker login. Migration `0012_marketing_workflow.sql` assigns Eypa to owner coordination, Luqman to production, Dr Shahril to review and Muz to publishing using their existing usernames. SuperAdmins can perform all workflow actions and change the effective workflow user without changing their tracker login. Other accounts can view the workflow. Every workflow retains its assigned account IDs and action history. Switching is stored per authenticated session and records both identities. Logout and loss of SuperAdmin privileges revoke the corresponding access.

## Listing synchronization

Creating a workflow resolves the reference through existing report references and owner report history, then checks original listing links and property/contact matches. Ambiguous matches require a manual choice. A reference, owner ID and category listing ID can each belong to only one workflow. Concurrent creation is serialized with the existing report/owner writers and backed by unique constraints.

The workflow updates only nonblank fields supplied at creation or subsequently changed in the owner brief. Independent sheet edits to unchanged fields, assignments, renewal dates, tenure and manual notes are preserved. A single managed section of category notes retains the reference, owner information, source briefing, approved materials and broadcast completions. Approved materials and a link back to the workflow also appear in owner/category information panels. Publication URLs are inserted into the existing advertisement table only when not already present for that listing. Previous publications remain available.

New owners have missing property details marked pending. Confirmed owner permission marks the owner Listed/Contacted and creates or reuses the correct category record. New category records start Pending until the team completes their details. Withdrawing previously confirmed permission unlists the owner and archives the linked category; confirming it again restores the same row. Material and publishing stages never change availability by themselves. An external unlisting or archive blocks publishing until resolved. Removed linked records cause a visible conflict instead of recreation.

## Storage and deployment

Bind a private Cloudflare R2 bucket as `WORKFLOW_MEDIA` to the existing Pages production environment. Do not enable public bucket access. Uploaded images and videos are stored under generated workflow/object IDs, validated by file signatures, limited to 30 MiB, and served only through the authenticated `/api/workflow/files/…` route. Failed database writes remove the newly uploaded orphan object. No local sample workflows or files are copied to production.

Migration 0012 is additive and managed by Drizzle. Test it on a production-derived branch and establish a recovery snapshot before applying it through the direct production connection. Deploy through the existing GitHub main → Cloudflare Pages pipeline only after tests and the private storage binding are ready. Code rollback leaves the additive workflow tables and private files intact.

Checks: `npm run test:workflow`, `npm run lint`, `npm run build`, Pages Functions compilation, existing owner/report regressions, and `WORKFLOW_DATABASE_PREVIEW=1 node --import tsx scripts/workflow-ui-check.ts` (set the environment variable using the current shell). The connected browser test uses disposable PGlite records and media on port 4194. The standalone local preview remains on port 4193 and keeps its independent sample data.

## Verification record

Production-derived test branch: `br-floral-union-b3uj2h1p`, `workflow-integration-test-2026-10-16`. Initial migration preserved all 1,539 owner rows, 107 category rows, 117 publications, 3 reference mappings and 9 accounts by whole-row hashes and counts. A real multi-connection concurrency test confirmed that two identical create requests reuse one workflow and linked record pair. Local production-handler tests cover role enforcement, session isolation, CSRF, private uploads, orphan cleanup, publication synchronization and privilege/logout revocation. Desktop and mobile connected handoffs pass. Production rollout status is recorded separately after deployment verification.
