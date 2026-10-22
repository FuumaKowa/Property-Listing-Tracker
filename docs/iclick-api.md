# IClick Property listing feed

The tracker exposes a read-only partner API at `GET /api/v1/iclick/listings`. It is intended for IClick Property's server to call; this tracker API does not publish ads to IClick.

## Authentication

Every request must include `Authorization: Bearer <token>`. The token is the Cloudflare Pages secret named `ICLICK_API_TOKEN`. Until that secret is configured, the endpoint fails closed with `503`. Never put the token in browser code, a URL, a chat message, or a source-control file. Share it with the IClick developer through an approved secure channel after deployment.

## Endpoints

- `GET /api/v1/iclick/listings?limit=50&cursor=0` returns up to 100 active, unarchived rows from the category listings table. `cursor` is the last numeric listing ID returned; use the response's `nextCursor` for the next page. Owner master-list rows are never queried or returned.
- `GET /api/v1/iclick/listings/{id}` returns one active, unarchived category listing.
- `GET /api/v1/iclick/listings/{id}/images/{fileKey}` streams an approved image. Use the same bearer token for this request.

All responses use JSON except image responses. The list response has `version: "1.0"` and a `data` array. A listing contains `id`, `reference`, `property`, `category`, `location`, `tenure`, `availableUnits`, numeric `askingPrice` (MYR), `currency`, `status`, `agent`, `negotiator`, `contactPhone`, workflow `details`, approved `copywriting`, `images`, existing `publications`, `publishReady`, `missing`, and `updatedAt`. Fields without saved values are `null` or empty arrays. `missing` can contain `numeric_price`, `approved_copywriting`, or `approved_image`; do not send a record to ad publishing unless `publishReady` is `true`.

Image entries include `id`, `title`, `contentType`, and an absolute `url`. Image URLs are private and require the bearer token. The tracker returns current, approved, non-original photo/poster materials belonging to the listing's linked marketing workflow. Other files and unapproved materials are not exposed.

## Current readiness rules

A row is included in the feed only while its category listing status is exactly `Active` and it is not archived. A real property name and location, a numeric price greater than zero, current approved copywriting, and at least one approved image are required for `publishReady: true`. This feed includes active rows that are not ready so IClick can report or skip them using the `missing` field. Internal listing notes are not exposed.

## Example

```http
GET /api/v1/iclick/listings?limit=50&cursor=0 HTTP/1.1
Host: property-listing-tracker.nielstudios.com
Authorization: Bearer <token>
```

Example result:

```json
{
  "version": "1.0",
  "data": [
    {
      "id": 123,
      "reference": "WTS-202610-00008",
      "property": "Laman Seri",
      "category": "Subsale Direct Listing (SSDL)",
      "location": "Seksyen 27, Shah Alam",
      "askingPrice": 1550000,
      "currency": "MYR",
      "status": "Active",
      "copywriting": "Approved marketing copy appears here",
      "images": [
        {
          "id": "material-id",
          "title": "Approved exterior",
          "contentType": "image/jpeg",
          "url": "https://property-listing-tracker.nielstudios.com/api/v1/iclick/listings/123/images/<file-key>"
        }
      ],
      "publishReady": true,
      "missing": []
    }
  ],
  "nextCursor": "123"
}
```

Before enabling the integration, configure `ICLICK_API_TOKEN` in the Cloudflare Pages production environment, deploy the API, then give IClick the base URL, this document, and the token through a secure channel. Rotate the secret in Cloudflare if it is exposed or needs revocation.
