# Contacted seeding stage

Master Listing Owner accepts IFU1, IFU2, IFU3 and Contacted. The follow-up card, both API adapters and spreadsheet imports use the same allowed values. Imported Contacted values are case-insensitive. Existing permissions and inactivity rules still apply.

Migration 0007_owner_contacted_stage.sql expands only the owner_listings seeding_status check constraint. It does not update any row or change normal listings. After local review and approval, test this migration on an isolated Neon branch, then run npm run db:migrate with the direct DATABASE_URL_UNPOOLED before deploying the corresponding application changes. Do not run db:push.
