# Owner listing category creation

Saving a new owner record as Listed, or changing an existing record from Unlisted/Rejected to Listed, creates a category listing. `rent` maps to Rental; `sale` maps to Subsale Direct Listing (SSDL). Missing or unrecognized source values require a selection in both the follow-up card and owner edit/add form. The selected value is stored on the owner record; recognized source values take precedence over client input.

The API saves the owner change, category row and audit entries in one SQL statement. Permission checks and version checks apply before the owner mutation. A unique `listings.source_owner_listing_id` prevents duplicate category rows across repeated saves and status toggles. Existing category rows, including archived or sold rows, are preserved. Deleting a master record leaves its generated category row and source ID intact.

New category rows copy property name, location, tenure, owner phone and the assigned agent. Owner name, exact decimal price, original post link, property type, size, bedrooms and bathrooms are retained in notes where available. The assigned agent is the lister/negotiator; the owner is the legacy contact. PIC is the user performing the save. New rows start Active with one available unit and Not Renewed; expiry and publication repost dates remain unscheduled.

Migration `drizzle/0008_owner_promotion.sql` adds the source ID column and unique index. It does not backfill previously Listed owners or alter existing listing data. Apply migrations through `npm run db:migrate` using the direct connection before deploying API changes; do not use `db:push`.

Validation:

- `npm run test:owner-promotion`: local PGlite tests for routing, choices, API create/edit/follow-up paths, permission/version guards, duplicate prevention, archived/sold preservation, rollback and audits.
- `npm run test:owner-workflow`: existing owner workflow, API and location assignment regressions.
- Start `npm run preview:integrated`, then run `npm run test:owner-promotion-ui`: mobile/desktop browser checks using synthetic local records only.
- `npm run lint` and `npm run build`.

## Production migration — 2026-10-13

Recovery branch `owner-promotion-recovery-2026-10-13` (`br-cold-butterfly-b3eyqtog`) was created from the verified production branch and confirmed ready. Test branch `owner-promotion-test-2026-10-13` (`br-round-wildflower-b3tgq1ab`) passed the exact migration, with every original row and schema object preserved. Both Express and Cloudflare Pages database adapters passed real Neon flow tests, including concurrent saves, automatic rent/sale routing, explicit selection for missing categories and duplicate prevention after status toggles. Only synthetic records on the isolated test branch were used for mutation checks.

Production then applied migration 0008 through the direct connection. Original-field fingerprints matched across 1,380 owner records, 99 category listings, 2,680 owner history entries, 155 listing audits, 74 publication links, 11 channels, 10 login accounts, 20 sessions and five assignment rules. Original columns, indexes, constraints, owner functions and triggers were unchanged. The new nullable source column and unique index were verified, all source links started empty, and all nine applied migration hashes matched the local files. Recovery and test branches are retained. Private verification fingerprints are stored under ignored `.server/` paths.

Type checks, owner promotion/workflow/import regressions, OwnerHunter integration checks, mobile/desktop prompt tests, the production build and Cloudflare Pages Functions compilation passed before release. The existing Cloudflare deployment follows GitHub `main`.
