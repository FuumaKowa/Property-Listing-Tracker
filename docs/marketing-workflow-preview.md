# Marketing workflow local preview

Start with `npm run preview:workflow`, then open http://127.0.0.1:4193/workflow. The tracker header also has a Workflow link in this preview. It starts with a sample Daniel SuperAdmin session. No production credentials are loaded.

Use **View as** to switch between Daniel, Eypa, Luqman, Dr Shahril and Muz. The server enforces the selected user's workflow permissions. **Return to Daniel** remains available. Activity records both the original Daniel session and the person being represented. These are local sample identities; production accounts are not impersonated.

## Try the workflow

1. Open **Sample Palm Estate** as Eypa, review the brief and send it to production. Or create a new workflow by pasting a briefing and reviewing extracted details. Confirm permission explicitly.
2. Switch to Luqman. In Materials, upload photos/posters/video and save copywriting. Select prepared materials and submit for review. Required facts can remain pending during production.
3. Switch to Dr Shahril. The Platforms review opens automatically. Tick the destinations you want; unticked destinations are crossed out. Select submitted or approved materials once, then click **Approve and send to publishing** to approve the materials and hand all ready platforms to Muz together. Photos and copy can go ahead while TikTok waits for video. Save platform choices separately if materials are not ready, or request changes from Materials. Video destinations need video plus copy; other destinations need a visual and copy. Required checks must be complete before the handoff. Published destinations stay selected to preserve their links and history.
4. Switch to Muz. Each approved destination shows its material package. Enter the published link, or record completion for WhatsApp broadcasts. Record a blocker when necessary. No external ads are posted by the preview.
5. Switch to Eypa. The Owner report is generated from completed destinations. Copy it, send it outside the preview, then mark the interim/final report sent. Pending destinations are labelled. Generated and sent are separate states.

**Sample Jelutong Suites** starts with Facebook approved while TikTok waits for video. It demonstrates partial approval immediately. The sample visual is explicitly a placeholder; upload your own media to exercise previews/downloads.

## Storage and scope

Workflow state persists in ignored `.server/workflow-preview/state.json`; uploads persist in `.server/workflow-preview/media/`. JPEG, PNG, WebP, MP4 and WebM are supported up to 30 MiB per file. Originals and earlier versions remain. Replacing approved material requires fresh approval for affected destinations; historical published links remain visible.

The API runs only in the local preview launcher, bound to 127.0.0.1. It uses session cookies, CSRF checks, server-side effective-user permissions and optimistic listing versions. Files are served through authenticated routes; private directories and `/@fs/` access to the store are blocked before Vite.

This is a working local workflow prototype. It uses persistent local storage and sample workflow records. It does not provision a cloud bucket, migrate production tables, synchronize workflow records into live owner/category sheets, send WhatsApp messages, or deploy. A production release will require the private R2 adapter, database persistence, real-account assignments and linkage to the existing owner/category records.

## Verification

- `npm run test:workflow`: transitions, role restrictions, bulk platform choices and approval, partial approvals, revised materials, preservation of published links, owner reports, HTTP session switching, file validation and persistence.
- `node --import tsx scripts/workflow-ui-check.ts`: isolated temporary preview, real image/video uploads, all five user views, checklist approval, saving an empty selection, refresh discarding drafts, partial approval, interim/final sends, cross-platform unsaved drafts, private storage access, desktop 1440px and mobile 390px.
- `npm run lint`, `npm run build`, `npm run test:owner-summary`, `npm run test:listing-reports`.

The browser test creates its own temporary store on port 4192 and removes it afterward. It does not modify the user-facing preview on port 4193.
