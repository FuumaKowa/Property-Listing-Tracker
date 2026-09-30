# Paste publication reports

Open a normal property's detail card and choose **Paste report** in Published ads. Paste the report, choose **Preview links**, review the selected categories, and choose **Import links**. The destination property name is shown throughout. This feature does not post to external platforms.

The parser accepts numbered or labelled sections, repeated numbering, whitespace, plain URLs, Markdown links and angle-bracket URLs. Common platform aliases (Propguru, Iprop, Tele, FB) suggest existing active categories. Exact custom category names take precedence. Conflicting or ambiguous matches require a manual selection. Report labels such as “Tele Nhc Coa” are retained on the link. Missing/pending entries without valid URLs are displayed but cannot be imported. Unknown categories can be managed through the existing Publication channels control.

Existing links are kept. Duplicate URLs on this property are skipped, including repeat submissions. URLs are normalized consistently; query parameters remain intact. Different share URLs for the same remote post cannot be recognized as duplicates without platform-specific resolution. Report titles, owner names, phone numbers and other property details are not imported. Reports are parsed in the browser; only selected links, category IDs and labels are submitted.

`POST /api/listings/:id/publications/import` uses the existing session authentication and the same handler for Cloudflare Pages and Express. It accepts `{items: [{channelId, url, label}]}` (1–100 links). The transaction locks the property first, then uses a fresh READ COMMITTED snapshot to check duplicates, inserts eligible links and actor-attributed audit records, and returns the current links with added/skipped counts. Archived properties or unavailable categories reject the batch. A database/audit failure rolls back the batch; the browser retains the preview for retry.

No migration, new secret, third-party service, owner-table write or hosting change is required. All changes use the existing publication tables. New manually saved URLs also use standard URL normalization; existing records are not rewritten.

Run `npm run test:report-import`, `npm run test:publications`, `npm run test:safety`, `npm run test:ownership`, `npm run test:n8n`, `npx tsx scripts/owner-api-check.ts`, `npm run lint`, `npm run build`, and the existing Cloudflare Functions build. API tests use disposable PGlite transactions; real Neon concurrency is not exercised by that fixture.
