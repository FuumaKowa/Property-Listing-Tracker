# Master Listing Owner browsing

The existing single webpage now supports 25, 50 or 100 rows per page, with 50 as default. No additional page, route or hosting project is created. Row numbers refer to the current filtered and sorted result: start at 1 and continue across pages. Stored listing IDs are unchanged.

Agent dropdown counts respect all active filters except the agent selection. The main count and footer show the selected agent's exact matching total. My listings, Unassigned and Overdue start from a fresh filter set. Reset filters clears search, status, type, agent and advanced filters.

More filters contains location search, seeding stage (Not started, IFU1, IFU2, IFU3, Contacted), inclusive minimum/maximum RM prices, inclusive date-added bounds in DD/MM/YYYY using Malaysia calendar dates, and sorting by newest, oldest, price or longest inactivity. Missing activity dates sort last. Invalid/reversed price or date bounds show an error. Filters and page-size changes return to page 1. Mobile pagination returns the document to the first results; advanced filters remain scrollable on short screens.

All browsing is derived from the existing authenticated API response and never writes property data. The Contacted stage needs migration 0007_owner_contacted_stage.sql, which expands only the owner seeding check constraint and preserves every existing row. Deploy via the existing GitHub main / Cloudflare Pages workflow after migrating through the direct DATABASE_URL_UNPOOLED with npm run db:migrate.

Validation: test:owner-browsing covers combined filters, exact decimal prices, Malaysia dates, facets, numbering, clamped/empty pages and immutable input. Existing owner tests cover Contacted save/reload/history, spreadsheet imports and adapter parity. Isolated desktop/portrait/landscape UI smoke checks use synthetic listings.
