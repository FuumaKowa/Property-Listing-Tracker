# Listing creator and shared priority

Lister displays the existing `pm` value. No PM data is renamed or rewritten in the database. Agent and negotiator details remain separate.

PIC displays the authenticated original creator. New listings capture the session user ID and display name on the server; updates cannot replace those fields. Older records show “Creator not recorded” because their last editor does not establish the original creator. No guessed backfill is performed.

High priority is a shared database flag visible to all authenticated users. Stars can be toggled in the table or mobile cards, or in the edit form. “Priority only” filters the current sheet. There is no five-property limit. Existing records start unmarked.

Renewal controls the whole row/card background: Renewed is green, Want to be renew is orange, and Not Renewed is the default white. Selection uses an outline so it does not hide renewal color.

## Migration (must precede deployment)

`drizzle/0002_listing_creator_priority.sql` adds only:

```sql
ALTER TABLE public.listings
  ADD COLUMN created_by_user_id text,
  ADD COLUMN created_by_name text,
  ADD COLUMN is_priority boolean NOT NULL DEFAULT false;
```

Existing columns and values are preserved. Master Listing Owner and OwnerHunter are unchanged. Test on an isolated production-derived branch, retain a recovery snapshot, and verify existing row values before and after. With explicit production approval and the direct production connection configured as `DATABASE_URL_UNPOOLED`, run `npm run db:migrate`; do not use `db:push`. Deploy the application only after successful verification.

## Verification

`npm run test:ownership` checks migration preservation, trusted creator attribution, immutable creator on edits, shared priority updates, invalid priority rejection, and renewal presentation using disposable PGlite data. Existing publication, OwnerHunter, owner API, TypeScript, production build and Pages Functions compilation checks should also pass.

`npm run preview:integrated` serves synthetic local records only. Set `PREVIEW_PORT` to use a different local port. It does not connect to Neon.
