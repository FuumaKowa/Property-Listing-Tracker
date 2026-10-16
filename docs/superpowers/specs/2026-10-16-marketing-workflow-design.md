# Marketing workflow local preview

User approved the workflow design and partial approvals, and requested a working local preview before deployment. Daniel, the SuperAdmin, needs to act as each participant without signing out. This delivery is local only; production data, cloud buckets and deployments are outside this iteration.

## Experience

One listing workspace has Brief, Materials, Platforms, Owner report and Activity tabs. A board and My tasks filter show current handoff, pending approvals, platform completion and responsible people. Eypa confirms permission and hands off to Luqman; Luqman uploads originals/drafts and copy, submits materials; Dr Shahril reviews individual immutable material versions and approves a specific package for each chosen destination; Muz records publication links or completion for broadcasts; Eypa sends the generated report and records that action. Dr Shahril can inspect every stage.

Photos and copy may be approved for Facebook/Telegram while video remains pending. Platform approvals bind exact approved versions. Replacing an approved material invalidates affected platform approvals but preserves historical publications. Destinations have independent pending/approved/published/blocked states. Adding new destinations or changing approved packages makes an earlier owner report historical. Interim updates are allowed and labelled; final completion requires every selected destination to be published against its current approval.

Dr Shahril opens directly into a review checklist. All 24 destinations are visible together, with excluded destinations crossed out and select-all/clear controls. A single **Approve and send to publishing** action approves the selected submitted materials and creates packages for every ready selected destination. Video-dependent destinations remain pending when video is not selected. Previously approved packages and published links are retained when later materials are approved. Platform choices can also be saved before materials are ready, including an explicit empty selection. Destinations with publication history cannot be excluded. Refresh discards confirmed unsaved selections; failed saves retain them.

Owner permission, workflow stage and category availability are separate concepts. Missing details remain editable pending tasks. Required tasks block publishing approval until resolved. Unknown facts are never invented. Owner permission withdrawal pauses publishing. References are unique within the preview. Brief imports populate editable fields and retain the original report. Explicit action buttons move work; editing a field never silently submits a stage.

## Identity and storage

The local preview starts as a fictional Daniel SuperAdmin session, clearly labelled sample data. Switches are server controlled and session scoped, only the real SuperAdmin can switch. The effective user controls permissions; audit records keep both Daniel and the effective person. Return to Daniel is always available. Browser-supplied actor IDs do not grant permissions. Sample accounts are Daniel, Eypa, Luqman, Dr Shahril and Muz. These are preview identities, not production account credentials.

Files persist in an ignored local bucket directory with generated object keys; metadata and workflow state persist in an atomic JSON store. Support JPEG, PNG, WebP, MP4 and WebM, up to 30 MiB per file, and text copy. Validate content signatures and disallow executable formats/path traversal. Only the authenticated preview route serves files. Original versions remain accessible. This local bucket exercises the upload/preview/download workflow; a real private R2 adapter, database migration and production authentication integration are subsequent deployment work.

## Boundaries and verification

Mount the API only in the local preview entry point, bound to 127.0.0.1, with no dotenv loading or production connection. Existing sheets use their established synthetic preview data. Link workflow reference/property labels in the local UI; full production owner/category synchronization is not claimed by this local prototype. Keep existing production routes unchanged. Serialize writes, require listing versions, reject stale edits and keep unsaved form data on failures. Show errors by actions.

Verify core handoffs, cross-role denials, partial approvals, revised assets, report accuracy, interim/final sends, session switching, upload validation, persistence, and mobile/desktop use. Run TypeScript/build and relevant existing report regressions. Review the complete change before presenting the preview.
