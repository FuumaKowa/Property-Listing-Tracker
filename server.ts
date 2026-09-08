import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  getAllListingsFromDb,
  createListingInDb,
  updateListingInDb,
  deleteListingFromDb,
  getAuditLogs,
} from './src/db/listings.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

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
    res.status(201).json({ success: true, data: await createListingInDb(req.body, userInfo(req)) });
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
