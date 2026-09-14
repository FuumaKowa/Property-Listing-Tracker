import express, { type ErrorRequestHandler } from 'express';
import { validN8nKey } from './auth';
import { ingestListing, type ExecuteIngestQuery } from './repository';
import { IngestInputError, validateN8nListing } from './validation';

export function createN8nRouter(getApiKey: () => string | undefined, execute: ExecuteIngestQuery) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const supplied = req.headers['x-api-key'];
      if (!await validN8nKey(typeof supplied === 'string' ? supplied : undefined, getApiKey())) {
        res.status(401).json({ success: false, error: 'Unauthorized.' });
        return;
      }
      next();
    } catch { res.status(500).json({ success: false, error: 'Unable to process listing.' }); }
  });
  router.post('/', (req, res, next) => {
    if (!req.is('application/json')) { res.status(400).json({ success: false, error: 'Content-Type must be application/json.' }); return; }
    next();
  }, express.json({ limit: '64kb', strict: true }), async (req, res) => {
    try {
      const result = await ingestListing(execute, validateN8nListing(req.body));
      res.status(result.status === 'created' ? 201 : 200).json(result);
    } catch (error) {
      res.status(error instanceof IngestInputError ? 400 : 500).json({ success: false,
        error: error instanceof IngestInputError ? error.message : 'Unable to store listing. Please retry.' });
    }
  });
  router.all('/', (_req, res) => { res.setHeader('Allow', 'POST'); res.status(405).json({ success: false, error: 'Method not allowed.' }); });
  const parseError: ErrorRequestHandler = (_error, _req, res, _next) => {
    res.status(400).json({ success: false, error: 'Body must be valid JSON no larger than 64 KiB.' });
  };
  router.use(parseError);
  return router;
}
