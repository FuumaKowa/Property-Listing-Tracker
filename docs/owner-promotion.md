# Owner listing category creation

The manual owner add/edit form always shows Listing type, including while the status is Unlisted. `rent` maps to Rental; `sale` maps to Subsale Direct Listing (SSDL). A type may remain unspecified before listing, but missing or unrecognized source values require a selection before saving as Listed. The selected value is stored on the owner record; recognized source values take precedence over client input.

The API saves the owner change, category row and audit entries in one SQL statement. Permission checks and version checks apply before the owner mutation. Saving Unlisted or Rejected archives the linked category row so it disappears from the normal category sheet. Changing back to Listed restores an archived linked row, including one deleted from a category sheet, with its original ID, details, publication links and creator attribution. If no linked row exists, it creates one. A unique `listings.source_owner_listing_id` prevents duplicates; archive/restore operations increment the category version and add audit entries. Existing property and Sold Out/Pending status values are preserved during restoration. Deleting a master record leaves its generated category row and source ID intact.

New category rows copy property name, location, tenure, owner phone and the assigned agent. Owner name, exact decimal price, original post link, property type, size, bedrooms and bathrooms are retained in notes where available. The assigned agent is the lister/negotiator; the owner is the legacy contact. PIC is the user performing the save. New rows start Active with one available unit and Not Renewed; expiry and publication repost dates remain unscheduled.

Migration `drizzle/0008_owner_promotion.sql` adds the source ID column and unique index. It does not backfill previously Listed owners or alter existing listing data. Apply migrations through `npm run db:migrate` using the direct connection before deploying API changes; do not use `db:push`.

Validation:

- `npm run test:owner-promotion`: local PGlite tests for routing, choices, API create/edit/follow-up paths, permission/version guards, withdrawal/restoration, publication and sold-status preservation, rollback and audits.
- `npm run test:owner-workflow`: existing owner workflow, API and location assignment regressions.
- Start `npm run preview:integrated`, then run `npm run test:owner-promotion-ui`: mobile/desktop browser checks for manual type entry and the full list/unlist/category-delete/relist sequence using synthetic records only.
- `npm run lint` and `npm run build`.

## Production migration — 2026-10-13

Recovery branch `owner-promotion-recovery-2026-10-13` (`br-cold-butterfly-b3eyqtog`) was created from the verified production branch and confirmed ready. Test branch `owner-promotion-test-2026-10-13` (`br-round-wildflower-b3tgq1ab`) passed the exact migration, with every original row and schema object preserved. Both Express and Cloudflare Pages database adapters passed real Neon flow tests, including concurrent saves, automatic rent/sale routing, explicit selection for missing categories and duplicate prevention after status toggles. Only synthetic records on the isolated test branch were used for mutation checks.

Production then applied migration 0008 through the direct connection. Original-field fingerprints matched across 1,380 owner records, 99 category listings, 2,680 owner history entries, 155 listing audits, 74 publication links, 11 channels, 10 login accounts, 20 sessions and five assignment rules. Original columns, indexes, constraints, owner functions and triggers were unchanged. The new nullable source column and unique index were verified, all source links started empty, and all nine applied migration hashes matched the local files. Recovery and test branches are retained. Private verification fingerprints are stored under ignored `.server/` paths.

Type checks, owner promotion/workflow/import regressions, OwnerHunter integration checks, mobile/desktop prompt tests, the production build and Cloudflare Pages Functions compilation passed before release. The existing Cloudflare deployment follows GitHub `main`.

## Lifecycle correction — 2026-10-13

User testing identified that the initial creation-only behavior left Unlisted records visible and did not restore archived category rows on relisting. The corrected flow uses the existing archive fields and source link, so no additional migration is required. Both database adapters passed the full lifecycle sequence on the retained isolated Neon branch, including concurrent owner saves and actual category DELETE requests. Mobile and desktop tests also verified that a manual Rental type can be saved while still Unlisted.
