import type { DbUser } from './db/server_db';

declare global {
  namespace Express {
    interface Request {
      user?: DbUser;
    }
  }
}

export {};

