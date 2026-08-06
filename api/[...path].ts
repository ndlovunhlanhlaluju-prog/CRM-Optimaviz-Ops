/**
 * Vercel adapter for the same Express application used by `npm start`.
 *
 * The application itself remains hosting-neutral. This thin adapter only
 * supplies Vercel's request/response entrypoint; no CRM routes are duplicated.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

type VercelRequest = IncomingMessage & {
  body?: unknown;
  query?: Record<string, string | string[]>;
};

type VercelResponse = ServerResponse & {
  status?: (code: number) => VercelResponse;
  json?: (body: unknown) => VercelResponse;
  send?: (body: unknown) => VercelResponse;
};

let appPromise: Promise<any> | undefined;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[VERCEL ADAPTER] handler invoked', req.method, req.url);
  process.env['START_SERVER'] = 'false';
  process.env['ENABLE_BACKGROUND_JOBS'] = 'false';

  if (!appPromise) {
    console.log('[VERCEL ADAPTER] Creating app...');
    appPromise = import('../dist/server.cjs').then((mod: any) => {
      console.log('[VERCEL ADAPTER] Module loaded', Object.keys(mod || {}));
      const createApp = mod.createApp || mod.default?.createApp;
      if (!createApp) {
        console.error('[VERCEL ADAPTER] createApp not found in module');
        throw new Error('createApp not found in server bundle');
      }
      return createApp();
    }).catch(err => {
      console.error('[VERCEL ADAPTER] Failed to create app:', err);
      throw err;
    });
  }

  const app = await appPromise;
  console.log('[VERCEL ADAPTER] Handling request');
  return app(req, res);
}
