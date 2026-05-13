import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeStore } from '../src/store';

let dir: string;
let store: ReturnType<typeof makeStore>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pace-test-'));
  store = makeStore(join(dir, 'config.json'), join(dir, 'stats.json'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test('loadConfig — returns null when file absent', async () => {
  expect(await store.loadConfig()).toBeNull();
});

test('saveConfig / loadConfig — round-trips', async () => {
  await store.saveConfig({ orgId: 'abc-123', cookie: 'sessionKey=tok' });
  const c = await store.loadConfig();
  expect(c?.orgId).toBe('abc-123');
  expect(c?.cookie).toBe('sessionKey=tok');
});

test('loadStats — returns null when file absent', async () => {
  expect(await store.loadStats()).toBeNull();
});

test('saveStats / loadStats — round-trips', async () => {
  const stats = {
    updatedAt: '2026-05-13T10:00:00.000Z',
    credentialsStatus: 'valid' as const,
    situation: 'ALL_CLEAR',
    message: 'All pace indicators on track.',
    weekly: { deltaPp: -2, utilizationPct: 48, elapsedPct: 50 },
    session: { deltaPp: 1, utilizationPct: 21 },
  };
  await store.saveStats(stats);
  const loaded = await store.loadStats();
  expect(loaded?.situation).toBe('ALL_CLEAR');
  expect(loaded?.weekly.deltaPp).toBe(-2);
});
