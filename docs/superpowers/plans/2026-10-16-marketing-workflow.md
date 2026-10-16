# Marketing workflow implementation plan

> Implement in the current local checkout with one final independent review. The user's request to update locally authorizes this implementation; do not deploy.

**Goal:** A working local workflow with platform-specific partial approval and Daniel's user switcher.
**Architecture:** Shared pure workflow transitions; a serialized local store and private file bucket; an Express preview API with server-side sessions; a React board and detail workspace. Existing production APIs remain unchanged.
**Tech stack:** TypeScript, React, Express, Node filesystem, existing Vite and Playwright.
**Spec:** ../specs/2026-10-16-marketing-workflow-design.md

## Tasks

- [x] Add `src/workflow/model.ts`, `seed.ts` and `scripts/workflow-check.ts`. Test handoffs, role denials, independent approved destination packages, replacing approved assets, permissions withdrawal, and generated interim/final reports. Watch tests fail before implementing `applyWorkflowAction`, `workflowStage`, `ownerReport` and `parseBrief`.
- [x] Add `src/server/workflow/store.ts` and `router.ts`, with an isolated preview launcher. Test real HTTP session switching, CSRF, cross-role denials, stale version conflicts, persistence, invalid uploads and file isolation. Mutations use authenticated actual/effective identities, not request body identities.
- [x] Add focused React workflow components and styling. Integrate local-only navigation through the preview auth capability. Implement real uploads, briefs, revisions, material reviews, platform package selection, publication forms, generated owner reports and dual-identity history. Keep form drafts on failed saves.
- [x] Exercise the complete local handoff using browser tests at 390px and 1440px, plus server tests, lint/build and existing report regressions. Request independent code review, fix material issues, open the local preview for Daniel.

## Review focus

1. Old approved material replaced after publication: keep URL/history, require fresh approval and publishing confirmation.
2. Daniel acting as Muz: cannot approve or alter Eypa's brief; switching back stays available.
3. Video pending: approved photos/copy can publish on selected non-video destinations.
4. Owner report sent then another destination added: report becomes interim/historical, not final completion.
5. Failed/stale saves and invalid uploads: no data loss, clear visible errors, no public file exposure.

## Execution record

Local-first storage intentionally uses a persistent filesystem bucket. Cloud R2 provisioning and live synchronization are deferred until the user reviews this workflow. No production credentials are used by the new preview.

Verified: lint; workflow model/API tests; full desktop and mobile browser handoffs; original owner-summary and listing-report regression suites; production bundle build. Independent review found private Vite file exposure, unsafe default port, cross-platform draft protection and a missing reviewer handoff. All four were corrected and covered by API/browser/model checks. No deployment or production data changes.

Follow-up after user testing: replaced per-destination selection and approval with an all-platform checklist, strikethrough exclusions, and one **Approve and send to publishing** action. Ready destinations move together while video-dependent destinations wait. Existing approvals and published links survive later handoffs. Added domain tests for bulk authorization, atomic failures and history preservation, and desktop/mobile browser coverage for the combined handoff. A focused review found refresh retaining discarded drafts and an unsavable initial empty platform selection; both are corrected and covered by browser regressions. Workflow model/API tests, TypeScript checks, production build and complete desktop/mobile handoffs pass. The update remains local only.
