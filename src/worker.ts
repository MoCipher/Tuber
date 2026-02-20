// src/worker.ts
import { handleRequest } from './server/worker-handler';

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    return handleRequest(request);
  }
};
