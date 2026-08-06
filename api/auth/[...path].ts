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
  console.log('[VERCEL AUTH] handler invoked', req.method, req.url);
  process.env['START_SERVER'] = 'false';
  process.env['ENABLE_BACKGROUND_JOBS'] = 'false';

  if (!appPromise) {
    appPromise = import('../dist/server.cjs').then((mod: any) => {
      const createApp = mod.createApp || mod.default?.createApp;
      if (!createApp) {
        throw new Error('createApp not found in server bundle');
      }
      return createApp();
    });
  }

  const app = await appPromise;
  return app(req, res);
}
