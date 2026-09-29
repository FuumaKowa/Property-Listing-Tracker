import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  getAllListingsFromDb,
  createListingInDb,
  updateListingInDb,
  deleteListingFromDb,
  getAuditLogs,
} from './src/db/listings.ts';

import { getSessionUser } from './functions/api/_auth.ts';
import { handleOwnerListings } from './functions/api/_owner-listings.ts';
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

function userInfo(req: Request) {
  return {
    name: (req.headers['x-user-name'] as string) || req.body?.updatedByName || 'Team Member',
    email: (req.headers['x-user-email'] as string) || req.body?.updatedByEmail || undefined,
  };
}

app.get('/api/listings', async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await getAllListingsFromDb() });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load listings' });
  }
});

app.post('/api/listings', async (req: Request, res: Response) => {
  try {
    const user = await getSessionUser(new Request('http://localhost/api/listings', {
      headers: { Cookie: req.headers.cookie || '' },
    }), {DATABASE_URL: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || ''});
    if (!user) return res.status(401).json({success:false,error:'Unauthorized'});
    res.status(201).json({success:true,data:await createListingInDb(req.body, {
      uid: String(user.id), name: user.displayName || user.username,
    })});
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create listing' });
  }
});

app.patch('/api/listings/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid listing ID' });
    res.json({ success: true, data: await updateListingInDb(id, req.body, userInfo(req)) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update listing' });
  }
});

app.delete('/api/listings/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid listing ID' });
    res.json(await deleteListingFromDb(id));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete listing' });
  }
});

app.get('/api/audit-logs', async (req: Request, res: Response) => {
  try {
    const listingId = req.query.listingId ? Number(req.query.listingId) : undefined;
    res.json({ success: true, data: await getAuditLogs(listingId) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load audit logs' });
  }
});

// Use the same authenticated owner API in local/Node and Cloudflare deployments.
app.all(['/api/owner-listings', '/api/owner-listings/:id'], async (req: Request, res: Response) => {
  const request = new Request(`http://localhost${req.originalUrl}`, {
    method: req.method,
    headers: { 'Content-Type': 'application/json', Cookie: req.headers.cookie || '' },
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
  });
  const response = await handleOwnerListings({
    env: { DATABASE_URL: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '' },
    request, params: req.params.id ? { id: req.params.id } : undefined,
  });
  res.status(response.status).type('application/json').send(await response.text());
});

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
