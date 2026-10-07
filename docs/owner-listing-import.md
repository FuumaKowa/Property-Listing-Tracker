# Master Listing Owner spreadsheet import

The owner sheet's **Import Excel / CSV** button accepts `.xlsx`, `.xls`, and UTF-8 `.csv` files. Choose a worksheet, map its columns, then preview the rows before saving. Files are read in a browser worker; only mapped owner fields go to the authenticated API. Limits: 5 MB, 200 data rows plus a header, 60 columns, 20 worksheets. Export formula cells as values first. CSV quoting must be valid; commas, semicolons and tabs are supported, including Excel's `sep=` declaration.

Required columns: property name/address, property type, price. Optional: location, owner name, phone, property link, status, seeding stage. Detailed types such as Apartment and Terraced House normalize to the existing broad types. RM/comma prices normalize without using floating-point conversion. Numeric Excel prices use the underlying value rather than rounded display text; phone display formatting and text leading zeros are retained. Numeric phone cells cannot recover zeros already removed by Excel, so store phone numbers as text when preparing a file.

Missing owner name/phone becomes `Not captured`; blank status becomes `Unlisted`. Blank seeding means not started. Invalid rows are shown with an error and cannot be appended. Unmapped columns are shown before review. This imports manual owner records: historical dates, assignments, source IDs and OwnerHunter metadata are not imported. Added/assigned timestamps begin at import, and existing location rules assign agents. The normal listing sheets and their CSV importer are unchanged.

## Duplicate review

Suspected duplicates default to **Skip**. Each matching row can instead use **Append anyway**, which creates a separate owner record without modifying the match. Matches include existing records and earlier rows in the file. Matching uses a normalized property link, or matching property name, broad type, numeric price and contact information. URL comparison ignores protocol, www, case, fragments and a final slash; query strings remain significant. These are conservative warnings rather than guarantees that two advertisements represent the same property.

`POST /api/owner-listings/import` uses the existing session authentication in Express and Cloudflare Pages Functions. Preview and commit share validation and duplicate rules. Commit rechecks duplicates; a newly discovered match is skipped and included in the completion report. The user can import again to review it and choose Append anyway.

All inserts and the import audit event run in one READ COMMITTED transaction with a brief lock on `public.owner_listings` (5-second lock timeout). The lock is a separate statement so the following query sees concurrent commits. A request UUID and payload fingerprint stored in `owner_listing_events` make a retry of the same submission return its original result, including an intentional duplicate append. Changing the payload for the same UUID returns 409. Audit failure rolls back the new rows. The UI locks choices after a submission starts so retries use the same request.

No schema migration is required. No update/delete is issued for existing owner records, and the import never reads or writes `public.listings`. The OwnerHunter `(source, listing_id)` unique index remains intact.

## Validation

Run `npm run test:owner-import`, `npm run test:owner-workflow`, `npm run lint`, `npm run build`, and `npx wrangler pages functions build functions --outdir .server/pages`. The import tests use disposable PGlite, including rollback, assignment, normal-table isolation, retry behavior and adapter parity. They do not establish production multi-connection contention behavior.

For a synthetic UI preview, run `npm run preview:integrated` with `PREVIEW_PORT` set to an available port. This preview does not connect to Neon. No production migration or deployment is part of the local review.
