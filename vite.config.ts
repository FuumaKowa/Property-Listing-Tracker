import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { handleExtract, handleChat, handlePMAlert, handleStandardize } from './src/server/geminiService';

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        if (req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });

          req.on('end', async () => {
            let body: any = {};
            try {
              body = JSON.parse(bodyStr || '{}');
            } catch (e) {
              // ignore
            }

            res.setHeader('Content-Type', 'application/json');

            try {
              if (req.url === '/api/gemini/extract') {
                const result = await handleExtract(body.text || '');
                res.end(JSON.stringify(result));
                return;
              }

              if (req.url === '/api/gemini/chat') {
                const result = await handleChat(body.message || '', body.history || [], body.tableData || []);
                res.end(JSON.stringify(result));
                return;
              }

              if (req.url === '/api/gemini/generate-pm-alert') {
                const result = await handlePMAlert(body.listing);
                res.end(JSON.stringify(result));
                return;
              }

              if (req.url === '/api/gemini/standardize') {
                const result = await handleStandardize(body.listings || []);
                res.end(JSON.stringify(result));
                return;
              }

              next();
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err?.message || 'Server error' }));
            }
          });
          return;
        }

        if (req.url === '/api/health') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
