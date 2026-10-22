# Pages-native workflow preparation

Eypa creates or opens a listing workflow, confirms the owner gave permission, verifies the public listing facts, uploads the original photographs, and hands the brief to production. In the **Production** tab, the browser renders the selected portrait and square poster templates from those photos, then produces portal, social, and WhatsApp copy from saved facts. The output is saved as private workflow materials and automatically marked ready for Muz. Muz still chooses publishing platforms and records ad links. No ads are published automatically.

Poster and copy generation runs locally in the browser. It uses no OpenAI API, paid AI account, or separate rendering worker. It does not invent facts or send owner contact details into marketing copy. The contact footer currently uses Dr Shahril's configured default number. Original owner photos stay private and are retained separately from generated poster files.

Video montage generation is not included in this Pages-native workflow yet. TikTok and any other video-dependent platform remain pending until a video material is uploaded and approved through the workflow. The older Node/FFmpeg worker code is not required for the poster and copy path; do not enable `WORKFLOW_PRODUCTION_ENABLED` for this release.

## Local verification

Run `npm run preview:workflow` to start an isolated local preview, then open its printed localhost address. The preview uses local synthetic data and a temporary private file directory. Use the SuperAdmin role switcher to test the Eypa and Muz stages.

Run `npm run test:workflow`, `npm run test:automation`, `npm run lint`, and `npm run build` for regression, browser-render, type, and build checks.

## Live storage requirements

The Pages workflow uses the existing authenticated upload endpoint and private Neon-backed media storage. The production session reports storage availability; the workflow disables uploads and generation if storage is unavailable. Keep original photos private. The IClick feed exposes only approved current listing images through its authenticated bearer-token API.
