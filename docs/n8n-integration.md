# OwnerHunter ingestion — corrected architecture

The owner-only migration has been applied to production with explicit rollout approval. Verification passed: owner columns increased from 11 to 27, the owner unique index exists, the existing owner record is preserved, and all 28 normal listings plus their schema are unchanged. The Cloudflare Production ingestion secret has been verified as configured and encrypted. The reviewed code is ready for the authorized GitHub deployment; live endpoint verification follows deployment.

## Endpoint and isolation

POST https://property-listing-tracker.nielstudios.com/api/integrations/n8n/owner-listings

This route exclusively inserts/selects public.owner_listings (Master Listing Owner). It never writes public.listings, project_category, or listing_audit_logs. The previous /api/integrations/n8n/listings handler has been removed; it was not deployed and no compatibility alias is needed. Configure n8n with the new route.

Production was inspected through the authenticated Neon connector on September 14, 2026: production branch br-withered-math-b3b51re5 has 19 normal listing columns and 11 owner columns, with the expected owner type/status and nonempty contact/name constraints. The existing manual owner CRUD and normal listing routes remain unchanged.

Cloudflare Pages Functions is the production runtime. functions/api/integrations/n8n/owner-listings.ts uses the existing getDb(env) Neon HTTP client, wrapped by Drizzle. Express uses its existing cached db connection. Both adapters share authentication, validation, normalization and the owner-only repository. There is no new runtime connection or duplicate owner model.

## Corrected migration

The sole local migration is drizzle/0000_n8n_ingestion.sql. It has been rewritten because the old version was never applied to production. Its journal entry is retained and its full schema snapshot corrected. Drizzle generation reports no pending schema differences. Do not apply this rewritten history on the old n8n-ingestion-test branch, whose journal/schema reflects the obsolete migration; use a fresh production-derived branch.

The migration adds exactly 16 nullable columns to public.owner_listings:

| Columns | Type |
| --- | --- |
| source, listing_id, transaction_type, location, source_property_type, size, tenure, advertiser_type, owner_status, discovery_channel | text |
| bedrooms | integer |
| bathrooms | numeric(8,2) |
| owner_score | numeric(10,4) |
| owner_evidence | jsonb |
| listing_date | date |
| found_at | timestamptz |

It creates owner_listings_source_listing_id_unique on (source, listing_id). No extra title, price, URL or phone columns are added. Existing owner data, constraints and defaults remain unchanged. There are no ALTER/INSERT/UPDATE/DELETE statements targeting public.listings. Existing manual owner rows have NULL metadata and remain valid. The migrator additionally maintains drizzle.__drizzle_migrations bookkeeping.

The exact SQL is included below.

```sql
-- Unapplied production migration, corrected to target Master Listing Owner only.
ALTER TABLE public.owner_listings
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS listing_id text,
  ADD COLUMN IF NOT EXISTS transaction_type text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS source_property_type text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS bedrooms integer,
  ADD COLUMN IF NOT EXISTS bathrooms numeric(8,2),
  ADD COLUMN IF NOT EXISTS tenure text,
  ADD COLUMN IF NOT EXISTS advertiser_type text,
  ADD COLUMN IF NOT EXISTS owner_status text,
  ADD COLUMN IF NOT EXISTS owner_score numeric(10,4),
  ADD COLUMN IF NOT EXISTS owner_evidence jsonb,
  ADD COLUMN IF NOT EXISTS listing_date date,
  ADD COLUMN IF NOT EXISTS discovery_channel text,
  ADD COLUMN IF NOT EXISTS found_at timestamptz;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS owner_listings_source_listing_id_unique
  ON public.owner_listings (source, listing_id);
```

## Validation and mapping

Required: source, listing_id, title, price, url, and a recognized property_type. Missing property data is rejected, not invented. Source is trimmed/lowercased; identifiers allow ASCII letters/digits and conservative separators (source also allows spaces). IDs remain strings, preserving leading zeros. URLs must be absolute HTTP(S), at most 2048 characters, without embedded credentials/control characters. The workflow must supply the individual listing URL, not a search page.

- title → property_name (nonempty, up to 300 characters).
- price → property_price (numeric(18,2)); RM prefix and correctly grouped commas are normalized. Malformed grouping, negative values and unsupported currencies are rejected.
- url → property_link.
- owner_name → owner_name; phone → no_tel. Empty/missing values become the literal sentinel "Not captured". This means missing information and is never verified contact information. The trusted upstream workflow must only supply verified names/phones; the API does not independently verify identity or infer it from evidence.
- status always starts Unlisted; updated_by_name is n8n Owner Hunter.
- property_type is classified by an explicit case-insensitive alias list. No fuzzy guesses: unknown types return 400. The original trimmed value is preserved in source_property_type.

| Category | Accepted source types |
| --- | --- |
| highrise | highrise, Condominium, Condo, Apartment, Flat, Serviced Residence, Service Residence |
| landed | landed, Terraced House, Terrace House, Semi-Detached House, Semi Detached, Semi-D, Bungalow, Townhouse, Cluster House |
| land | land, Residential Land, Agricultural Land |
| commercial | commercial, Shop, Shoplot, Office, Factory, Warehouse, Industrial |

Optional location/tenure and metadata remain NULL when absent. Bedrooms accepts integer strings, bathrooms and owner_score accept decimal strings/numbers, size preserves units, and empty listing_date/found_at become NULL. Dates require valid YYYY-MM-DD; timestamps require ISO timezone and are normalized to UTC. owner_evidence supports JSON strings, objects or arrays (up to 16 KiB UTF-8). Request bodies are limited to 64 KiB; unknown fields and malformed JSON return 400.

## Responses and examples

See n8n-example.json for the full incoming payload, n8n-created.json for a complete illustrative 201 response, and n8n-already_exists.json for the duplicate 200 response. Both return the same owner-field record shape; decimal values are strings for precision. IDs in the examples are illustrative.

201: {"success":true,"status":"created","record":{...stored owner record...}}

200: {"success":true,"status":"already_exists","record":{...same existing owner record...}}

Duplicates do not update contacts, property data, status, or timestamps. Unique-index arbitration handles concurrent inserts; a fresh SELECT returns the winning row. 401 is returned for missing/invalid API keys, 400 for invalid input, 405 for authenticated non-POST, and 500 with a generic message for database failures. No database secrets are returned. No CORS configuration is needed.

## Test results

Passed npm run lint, npm run build, npm run test:n8n, built Node smoke checks and local Cloudflare Functions compilation. Local tests cover owner-only SQL, preserved normal rows/schema/audit, required/malformed input, contact sentinels and provided contacts, all four requested property-type examples, invalid types, formatted RM prices, JSON evidence, authentication, duplicate row counts, and 12 concurrent submissions (one created, eleven already_exists).

Fresh branch n8n-owner-ingestion-test (br-young-hall-b3g883ca) was created directly from production, independently of the old modified test branch. The actual Drizzle migration succeeded there. Both Node PostgreSQL and Neon HTTP adapters passed 401/201/200 tests, the owner row count increased by exactly one, and a direct duplicate insert failed with PostgreSQL 23505. Hash/count and column comparisons confirmed public.listings data/schema were unchanged. The uniquely identified test owner row was removed afterward. The migrated branch remains available for review. Production was only inspected with SELECT statements during branch testing. The subsequently approved production migration and verification are recorded at the top of this report.

## Later rollout commands — only after approval

Keep the existing Cloudflare Pages database and login secrets. Add N8N_INGEST_API_KEY as a Production secret and the matching n8n Header Auth credential named X-API-Key. Never put it in VITE variables, React, tracked .env, or browser configuration. Express reads process.env.N8N_INGEST_API_KEY; Pages reads the server-side env binding.

After explicit production approval, run from app with the intended direct production connection injected into the process:

```powershell
$env:DATABASE_URL_UNPOOLED = '<reviewed direct production connection string>'
npm run db:migrate
```

.env.local is not automatically loaded by this migration command. Do not use db:push. Apply the reviewed migration before deploying through GitHub → Cloudflare Pages. This document does not authorize deployment.

After deployment and securely configuring your local test key:

```powershell
Invoke-RestMethod -Uri 'https://property-listing-tracker.nielstudios.com/api/integrations/n8n/owner-listings' -Method Post -Headers @{ 'X-API-Key' = $env:N8N_INGEST_API_KEY } -ContentType 'application/json' -Body (Get-Content -Raw './docs/n8n-example.json')
```

```bash
curl 'https://property-listing-tracker.nielstudios.com/api/integrations/n8n/owner-listings' -H "X-API-Key: $N8N_INGEST_API_KEY" -H 'Content-Type: application/json' --data-binary @docs/n8n-example.json
```

In n8n, branch on response status == created; only that branch continues to Sheets/Telegram. Use the record's property_name/property_price/property_link/no_tel fields downstream, or retain the incoming payload separately. Source fields are not duplicated as title/price/url/phone in the stored response.

## Files modified or added in this refactor

- src/db/schema.ts: metadata moved from normal listings to ownerListings.
- src/server/n8n/validation.ts, repository.ts: owner mappings, required data, classification, owner-only insertion/deduplication.
- server.ts and functions/api/integrations/n8n/owner-listings.ts: explicit new route; old Pages handler removed.
- drizzle/0000_n8n_ingestion.sql and drizzle/meta/0000_snapshot.json: corrected owner-only migration/snapshot; original journal retained.
- scripts/n8n-check.ts, n8n-production-check.ts, n8n-schema-check.ts, n8n-neon-branch-check.ts: isolation, adapter and Neon branch verification.
- docs/n8n-integration.md, n8n-example.json, n8n-created.json, n8n-already_exists.json: corrected setup, full payload/responses and rollout report.

Other local changes from the earlier implementation remain: shared auth/Express/Pages modules, migration script/config, .env.example/.gitignore, package and lock files, Pages type checking, and backend build output moved from public dist to .server. No frontend or normal category behavior was changed by this refactor.
