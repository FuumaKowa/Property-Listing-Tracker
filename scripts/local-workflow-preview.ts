// Explicit local entry point. No dotenv, production database or cloud bucket access.
process.env.WORKFLOW_PREVIEW='1';
process.env.PREVIEW_PORT=process.env.PREVIEW_PORT||'4193';
await import('./local-publications-preview');
