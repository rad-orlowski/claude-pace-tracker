import type { makeStore } from './store.js';
import { isValidStatePayload, type StatePayload } from './payload.js';
import { classifyFreshness } from './freshness.js';
import { WARN_AFTER_MIN, ERROR_AFTER_MIN } from './freshness-config.js';

type Store = ReturnType<typeof makeStore>;

export interface SidecarState {
  lastState:   StatePayload | null;
  lastStateAt: Date | null;
  lastSeenAt:  Date | null;
}

export function startHttpSidecar(
  port:  number,
  store: Store,
  state: SidecarState,
): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    port,
    hostname: '127.0.0.1',
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === 'POST' && url.pathname === '/state') {
        let body: unknown;
        try { body = await req.json(); }
        catch { return new Response('Invalid JSON', { status: 400 }); }
        if (!isValidStatePayload(body)) return new Response('Invalid payload', { status: 400 });

        state.lastState   = body;
        state.lastStateAt = new Date();
        state.lastSeenAt  = new Date();
        await store.saveState(body);
        return Response.json({ ok: true });
      }

      if (req.method === 'POST' && url.pathname === '/heartbeat') {
        state.lastSeenAt = new Date();
        return Response.json({ ok: true });
      }

      if (req.method === 'GET' && url.pathname === '/status') {
        const f = classifyFreshness({
          now:           new Date(),
          lastStateAt:   state.lastStateAt,
          lastSeenAt:    state.lastSeenAt,
          warnAfterMin:  WARN_AFTER_MIN,
          errorAfterMin: ERROR_AFTER_MIN,
        });
        return Response.json({
          connected:   true,
          lastStateAt: state.lastStateAt?.toISOString() ?? null,
          lastSeenAt:  state.lastSeenAt?.toISOString()  ?? null,
          freshness:   f.freshness,
          dataAgeMin:  f.dataAgeMin,
          liveAgeSec:  f.liveAgeSec,
          situation:   state.lastState?.situation.key ?? null,
        });
      }

      return new Response('Not Found', { status: 404 });
    },
    error(err) {
      console.error('[pace-mcp] HTTP error:', err);
      return new Response('Internal Error', { status: 500 });
    },
  });
}
