// src/worker.ts
import { handleRequest } from './server/worker-handler';

globalThis.addEventListener('fetch', (event: any) => {
  event.respondWith(handleRequest(event.request));
});
