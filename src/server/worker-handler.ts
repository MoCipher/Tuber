// src/server/worker-handler.ts
import { searchHandler } from '../../server/searchHandler';

export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/search')) {
    // Parse query string
    const q = url.searchParams.get('q') || '';
    // Use the same logic as your Express handler
    try {
      const result = await searchHandler(q);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }
  return new Response('Not found', { status: 404 });
}
