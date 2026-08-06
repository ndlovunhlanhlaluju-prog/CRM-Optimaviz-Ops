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
  // Prevent the standalone listener and long-running schedulers from starting
  // inside a short-lived serverless invocation.
  process.env.START_SERVER = 'false';
  process.env.ENABLE_BACKGROUND_JOBS = 'false';

  if (!appPromise) {
    appPromise = import('../server').then(({ createApp }) => createApp());
  }

  const app = await appPromise;
  return app(req, res);
}