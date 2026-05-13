import { makeStore } from './store.js';

type Store = ReturnType<typeof makeStore>;

export function startHttpSidecar(
  port:      number,
  store:     Store,
  onConnect: () => Promise<void>,
): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === 'GET' && url.pathname === '/status') {
        const stats  = await store.loadStats();
        const config = await store.loadConfig();
        const credentialsStatus = stats?.credentialsStatus
          ?? (config ? 'valid' : 'missing');
        return Response.json({
          connected:         true,
          credentialsStatus,
          lastPoll:          stats?.updatedAt ?? null,
          situation:         stats?.situation ?? null,
        });
      }

      if (req.method === 'POST' && url.pathname === '/credentials') {
        let body: any;
        try { body = await req.json(); } catch {
          return new Response('Invalid JSON', { status: 400 });
        }
        if (typeof body?.orgId !== 'string' || typeof body?.cookie !== 'string') {
          return new Response('Missing orgId or cookie', { status: 400 });
        }
        await store.saveConfig({ orgId: body.orgId, cookie: body.cookie });
        await onConnect();
        return Response.json({ ok: true });
      }

      return new Response('Not Found', { status: 404 });
    },
    error(err) {
      console.error('[pace-mcp] HTTP error:', err);
      return new Response('Internal Error', { status: 500 });
    },
  });
}
