# Five-agent Selangor coverage

This coverage applies exclusively to Master Listing Owner. The existing database assignment trigger and explicit **Apply location rule** action read the same `owner_assignment_rules` table, including spreadsheet imports.

| Agent | Areas |
| --- | --- |
| Dr Shahril | Shah Alam, Setia Alam, Alam Impian |
| Hakim | Klang, Port Klang, Kapar |
| Luqman | Petaling Jaya, Damansara, Kota Damansara, Sunway, Ampang |
| Ikhwan | Puchong, Bandar Saujana Putra, Cyberjaya, Subang Jaya, Seri Kembangan, Bangi, Kajang, Semenyih, Sepang |
| Muz | Rawang, Puncak Alam, Sungai Buloh, Selayang, Bukit Beruntung |

Accepted aliases: **PJ** for Petaling Jaya; **BSP** and the existing **Bandar Saujana Putera** spelling for Bandar Saujana Putra. Locations are matched without regard to case, using whole phrases. Multiple matching areas belonging to one agent are accepted. A location matching different agents remains unassigned for an Admin to review.

The update is recorded in `drizzle/0006_owner_selangor_coverage.sql`. It changes only the five rules' `areas` values and adds a before/after audit event for each changed rule. It preserves `user_id` and `agent_label`. It does not alter any table structure, property record, existing assignment, assignment date, follow-up stage, activity timestamp or normal listing category. The 72-hour inactivity alert stays unchanged. Existing unassigned properties are not automatically reassigned; an Admin can use Apply location rule when appropriate.

After local review and approval, use the configured direct production connection through `DATABASE_URL_UNPOOLED` and `npm run db:migrate`. Do not use `db:push` or rewrite the already-applied 0005 migration. Verify the five login mappings before/after and confirm all existing owner/listing records remain intact. The current website reads these areas from the database, so the updated coverage appears on refresh.

Tests: `npm run test:owner-workflow` covers all 25 requested areas, three aliases, phrase boundaries, ambiguous locations, preserved existing rows/accounts/schema, audit entries and explicit reassignment. `npm run test:owner-import` verifies import compatibility with the updated rules. The local integrated preview uses a disposable database with synthetic properties and the revised coverage.
