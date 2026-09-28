# Property details and publication channels

Date: 2026-09-28
Status: Written design for user review

## Outcome and scope

All normal listing sheets use one consistent table and a floating property detail card. Users maintain a shared collection of publication channels and attach each property's published advertisement links to those channels. Master Listing Owner, its database table, and OwnerHunter ingestion remain unchanged.

Publication channels (Telegram channel, TikTok, Mudah, PropertyGuru, or user-defined names) are distinct from the existing property/sheet categories. Existing sheet categories remain intact.

## Table and detail card

The normal table shows No, Property Address, Property Category, Location, Lister, PIC, Lister Phone, Available Units, Status, PropertyGuru Expiry, PropertyGuru Repost Date, and a compact Published Ads summary including Mudah when present. Avoid adding a permanent column for every custom channel. Retain selection, filtering, sorting, edit/delete actions, and audit access.

Clicking or keyboard-activating the property name/address opens its detail card. The card shows all existing property information, notes, attribution, expiry/repost details, and published ads grouped by channel. Missing values appear as empty/not provided, never fabricated. Multiple advertisements in the same channel are supported; each has a clickable URL and optional label/notes.

Close with the X button, an overlay click outside the card, or Escape. Clicking inside the card or on a link does not close it. Use a labelled modal dialog, focus trapping, and restore focus to its opener. The card scrolls internally, fits small screens, and prevents the background from scrolling. Viewing is read-only; explicit edit actions open editing controls so merely closing the detail card cannot discard edits.

Existing notes and legacy fields remain visible in the detail card. This feature does not introduce a general-purpose custom-field builder.

## Shared channel settings

Settings provides Publication Channels with add, rename, archive, and restore actions. A stable channel ID connects advertisements to a channel, so renaming appears consistently across every normal sheet. Removing a channel means archiving: existing links remain visible, but it is unavailable for new advertisements. Existing advertisements can still be edited or removed. No channel removal cascades into deleting advertisements.

Use trimmed, case-insensitively unique names, including archived names; offer restoration instead of creating a conflicting duplicate. Initial channels can include PropertyGuru, Mudah, Telegram, and TikTok, without inventing advertisement URLs. Users may name individual Telegram channels separately.

## Existing data and status compatibility

Reuse the existing property/address, category, location, available units, notes, and phone fields. Proposed display mapping for review: PIC uses the existing PM field; Lister uses Negotiator, falling back to Agent. Where both legacy people fields have values, show both in the detail card and preserve both in storage. New edits must not erase undisplayed legacy values.

Display the normal status choices as Active, Expired, and Sold. Retain the existing stored Sold Out value initially and label it Sold to avoid an unnecessary destructive data rewrite. Preserve legacy Pending records and display their current value until explicitly changed. Automatic expiry and form date edits must never turn Sold into Active or Expired.

The existing listing date remains the primary expiry date and is presented as PropertyGuru Expiry; retain its original stored representation and parsing compatibility. A new nullable repost date and a Manual/Auto tracking mode describe the planned PropertyGuru repost. They do not trigger external posting. Do not infer dates or links for existing records. Preserve existing renewal-intent behavior, including Want to be renew and In Progress.

## Persistence and API boundaries

Use the existing Drizzle schema and Neon connection helpers. Add publication_channels with a stable ID, name, archive timestamp, and creation/update timestamps. Add listing_publications referencing only public.listings and publication_channels, with URL, optional label/notes, and timestamps. Index the listing foreign key. Multiple records may use the same channel for one listing. Add nullable PropertyGuru repost date/mode fields to normal listings; reuse existing columns for other table fields.

Do not alter public.owner_listings or the n8n ingestion path. Do not rewrite applied migration 0000. Create a new additive migration for the new tables/indexes and nullable fields, review it, and test it on an isolated database before requesting production rollout.

Provide authenticated channel CRUD/archive and per-listing publication CRUD using existing session authorization and attribution patterns. Share validation and business rules between Cloudflare Pages Functions and the Express development adapter, using the project's existing database access for each runtime. No client secrets or new database connection architecture.

Require valid HTTP(S) URLs, disallow credentials in URLs, and cap URLs at 2,048 characters. Treat labels and notes as plain text, with server-side length limits. Reject missing listings, invalid channel IDs, and assigning new ads to archived channels. Links open in a new tab with noopener/noreferrer. Loading, empty, authorization, and save-error states must be visible; failed saves retain user input. Channel or publication edits must not overwrite unrelated listing fields.

Fetch publication details when the card opens. Fetch compact counts/channel summaries for visible listings in a batch rather than one request per row. Editing one property must not replace another colleague's unrelated changes.

## Approach and tradeoffs

Shared channel and publication tables are preferred because they preserve stable relationships through renames and support multiple links per channel. Fixed columns for each platform cannot support user-managed channels. Putting all links into a listing JSON blob is simpler initially but makes shared renaming and independent concurrent edits less reliable.

Keep existing listing components and routes, adding focused detail-card and channel-settings components. Avoid unrelated auth or dashboard refactoring.

## Verification and rollout

Test channel creation, rename, archive/restore, uniqueness, and existing-link preservation. Test multiple links per channel, safe URL validation, authorization, and parity between Pages and Express. Test modal keyboard access, X/outside/Escape closure, inside clicks, focus restoration, and mobile scrolling. Test legacy field preservation, Sold protection, renewal intent, and unchanged OwnerHunter behavior.

Run TypeScript checking, production build, relevant listing/ingestion regression tests, and Cloudflare Functions compilation. Use an isolated database for migration and CRUD tests. Verify existing normal and owner records survive unchanged before rollout.

No production migration, push, or deployment is part of this design-review step. Present the exact new migration and deployment steps after implementation and validation, before applying production changes.
