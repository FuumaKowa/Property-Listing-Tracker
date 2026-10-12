# Owner browsing implementation plan

Goal: browse and count Master Listing Owner without leaving the single Cloudflare webpage.
Architecture: keep current authenticated owner API and stored records; derive filters, agent facets, sorting and paged rows in a pure helper shared with tests. Contacted uses the prepared 0007 check-constraint migration.
Execution: inline, approved by user, then commit to main and deploy via existing Cloudflare Pages workflow.

- [x] Test combined filters, Malaysia dates, decimal prices, result numbering, agent counts, empty/stale pages and immutable input.
- [x] Implement 25/50/100 paging (default 50), filtered numbering across pages, counts, location/stage/price/date filters, sort options and quick views. Maintain desktop table and mobile cards.
- [x] Verify locally with synthetic data and UI; run all existing tests, lint, build and Cloudflare compilation. Review source and scan staged changes for secrets.
- [x] Test migration on a production-derived branch; verify all property rows and normal categories unchanged. Apply only 0007 in production through direct DATABASE_URL_UNPOOLED and db:migrate.
- [ ] Commit and push main; verify Cloudflare success and live browsing. Keep production data and normal listing behaviour intact.

Review: initial source review passed. Landscape header concern fixed by retaining the height cap at all widths and preserving mobile document scrolling; final review passed.
