# IClick Listing Workspace Design

## Goal

Give the team a dedicated IClick workspace for completing the existing company listing records that the IClick API exposes. Users should be able to enter a numeric asking price and upload listing photos without creating a second listing or editing the owner master list.

## Current problem

The read-only IClick feed is live, but it has no corresponding workspace for filling missing prices or adding listing photos. Existing rows can therefore appear in the feed while reporting `numeric_price`, `approved_copywriting`, and `approved_image` as missing. The API is correctly flagging them as not ready; the UI for resolving price and image gaps is absent.

## Proposed experience

- Add an **IClick** tab to the main tracker navigation.
- Show existing, active, unarchived category listings from the `listings` table. Never show or modify `owner_listings` records in this workspace.
- Show the listing identity and category, location, numeric asking price, current approved workflow copy, linked images, and a readiness state with its missing requirements.
- Allow users to edit the numeric asking price on the existing listing row and upload or remove IClick listing images.
- Keep the existing approved workflow copy as the source for ad text. If no approved copy exists, show that requirement as missing; generating or editing copy is outside this design.
- Save image metadata against the existing listing ID and image bytes in the configured private Neon Object Storage bucket. Do not create duplicate listing records.
- Have the existing read-only IClick feed read the same asking price and IClick images, preserving bearer-token access for feed and image requests. Uploaded IClick images become available to the feed after they are saved.

## Readiness

`publishReady` remains computed by the API. It requires a real property name and location, a positive numeric asking price, approved workflow copy, and at least one available approved workflow image or IClick workspace image. The workspace explains each unmet requirement rather than hiding incomplete listings.

## Data and security

- Reuse `listings.asking_price` as the single price value.
- Add listing-image metadata keyed to the existing listing ID, with a private object key, MIME type, title, size, and creation audit fields. Use a database migration with foreign-key cascade on listing deletion.
- Validate image MIME type and size on the server. Store only image files; reject unsupported content.
- Store image objects privately in Neon Object Storage. Stream them through authenticated app/API routes; do not expose bucket credentials or permanent public object URLs.
- Check listing edit permissions on price and image mutations. Keep the partner API read-only.

## Failure behavior

Image metadata and the object upload must not leave an orphaned object or a broken database reference on failure. If metadata persistence fails after upload, delete the new object. If cleanup fails, log the key for operational recovery without returning it to the browser. Return actionable errors for invalid type/size, storage outage, and stale listing versions.

## Scope boundaries

This design does not add AI copy generation, workflow approval, owner-master browsing, ad publication, or duplicate listing creation. Existing workflow copy and images continue to work as before; IClick images are an additional listing-linked source for the partner feed.

## Acceptance checks

1. The IClick tab lists category listings and never includes owner master records.
2. Saving a price updates the existing listing row, and the API returns that numeric value.
3. Uploading a valid image stores it privately, associates it with that listing, and makes it available through the bearer-protected IClick image endpoint.
4. Unsupported and oversized files fail without leaving a visible image entry.
5. `publishReady` changes when required price, approved copy, and image data are present; `missing` identifies the remaining requirements.
6. Existing listing workflows, owner listing flows, and read-only API behavior continue to pass their regression checks.
