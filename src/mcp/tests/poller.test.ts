import { test, expect, mock, afterEach } from 'bun:test';
import { Poller } from '../src/poller';
import { makeStore } from '../src/store';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CFG = { activeStartH: 7, activeEndH: 20, sleepStartH: 23, bandWeekly: 2, bandSession: 5 };

function makeUsageJson(allUtil = 40) {
  const future = new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString();
  const sess   = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
  return {
    seven_day:        { utilization: allUtil, resets_at: future },
    seven_day_sonnet: { utilization: allUtil, resets_at: future },
    five_hour:        { utilization: 10,      resets_at: sess   },
  };
}

test('Poller.poll — saves stats on 200 response', async () => {
  const dir   = await mkdtemp(join(tmpdir(), 'pace-poller-'));
  const store = makeStore(join(dir, 'config.json'), join(dir, 'stats.json'));
  await store.saveConfig({ orgId: 'org-1', cookie: 'sessionKey=tok' });

  const fetchMock = mock(() =>
    Promise.resolve(new Response(JSON.stringify(makeUsageJson()), { status: 200 }))
  );
  const poller = new Poller(store, CFG, fetchMock as any);
  await poller.poll();

  const stats = await store.loadStats();
  expect(stats?.credentialsStatus).toBe('valid');
  expect(stats?.situation).toBeTruthy();
  await rm(dir, { recursive: true, force: true });
});

test('Poller.poll — sets expired on 401', async () => {
  const dir   = await mkdtemp(join(tmpdir(), 'pace-poller-'));
  const store = makeStore(join(dir, 'config.json'), join(dir, 'stats.json'));
  await store.saveConfig({ orgId: 'org-1', cookie: 'sessionKey=tok' });

  const fetchMock = mock(() =>
    Promise.resolve(new Response('Unauthorized', { status: 401 }))
  );
  const poller = new Poller(store, CFG, fetchMock as any);
  await poller.poll();

  const stats = await store.loadStats();
  expect(stats?.credentialsStatus).toBe('expired');
  await rm(dir, { recursive: true, force: true });
});

test('Poller.poll — no-ops when config missing', async () => {
  const dir   = await mkdtemp(join(tmpdir(), 'pace-poller-'));
  const store = makeStore(join(dir, 'config.json'), join(dir, 'stats.json'));
  const fetchMock = mock(() => Promise.resolve(new Response('', { status: 200 })));
  const poller = new Poller(store, CFG, fetchMock as any);

  await poller.poll();
  expect(fetchMock).not.toHaveBeenCalled();
  await rm(dir, { recursive: true, force: true });
});
