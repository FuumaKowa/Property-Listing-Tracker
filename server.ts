import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {onRequestGet as readAudit} from './functions/api/audit-logs';
import {createListingsRouter} from './src/server/listings';

import { getSessionUser } from './functions/api/_auth.ts';
import {createOwnerListingsRouter} from './src/server/ownerListings';
import { db } from './src/db/index.ts';
import { createN8nRouter } from './src/server/n8n/express.ts';
import { createPublicationsRouter } from './src/server/publications/express.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Authenticate before the global body parser; the integration owns its bounded JSON parser.
app.use('/api/integrations/n8n/owner-listings', createN8nRouter(
  () => process.env.N8N_INGEST_API_KEY,
  statement => db.execute(statement),
));

app.use(express.json({ limit: '10mb' }));
app.use('/api', createPublicationsRouter(() => ({ DATABASE_URL: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '' })));

app.use('/api', createListingsRouter(() => ({DATABASE_URL:process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || ''})));
app.get('/api/audit-logs',async(req,res)=>{const response=await readAudit({env:{DATABASE_URL:process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || ''},request:new Request('http://localhost'+req.originalUrl,{headers:{Cookie:req.headers.cookie || ''}})});res.status(response.status).type('application/json').send(await response.text());});

app.use('/api',createOwnerListingsRouter(()=>({DATABASE_URL:process.env.DATABASE_URL||process.env.NEON_DATABASE_URL||''})));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
