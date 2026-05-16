import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeStore } from '../src/store';
import type { StatePayload } from '../src/payload';

let dir: string;
let store: ReturnType<typeof makeStore>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pace-store-'));
  store = makeStore(join(dir, 'state.json'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const sample: StatePayload = {
  schemaVersion: 1,
  pushedAt: '2026-05-16T14:00:00.000Z',
  raw: {
    seven_day:        { utilization: 40, resets_at: '2026-05-23T00:00:00.000Z' },
    seven_day_sonnet: { utilization: 35, resets_at: '2026-05-23T00:00:00.000Z' },
    seven_day_opus:   { utilization: 10, resets_at: '2026-05-23T00:00:00.000Z' },
    five_hour:        { utilization: 20, resets_at: '2026-05-16T18:00:00.000Z' },
  },
  computed: {
    window: 'active', resetInH: 71, daysLeft: 3,
    session:      { utilizationPct: 20, deltaPp: -2, elapsedPct: 22, trend: 'on-track' },
    allWeekly:    { utilizationPct: 40, deltaPp:  4, elapsedPct: 36, trend: 'over' },
    allDaily:     { deltaPp: 1, trend: 'on-track' },
    sonnetWeekly: { utilizationPct: 35, deltaPp: -1, elapsedPct: 36, trend: 'on-track' },
    sonnetDaily:  { deltaPp: 0, trend: 'on-track' },
    opusPct: 10,
  },
  situation: { key: 'ALL_OVER', params: { allWDp: 4 }, message: 'Test.', trend: 'over' },
};

test('loadState — returns null when file absent', async () => {
  expect(await store.loadState()).toBeNull();
});

test('saveState / loadState — round-trips a StatePayload', async () => {
  await store.saveState(sample);
  const loaded = await store.loadState();
  expect(loaded?.situation.key).toBe('ALL_OVER');
  expect(loaded?.computed.allWeekly.deltaPp).toBe(4);
});

test('loadState — returns null on malformed JSON', async () => {
  // simulate by writing junk
  const path = join(dir, 'state.json');
  await Bun.write(path, 'not-json');
  expect(await store.loadState()).toBeNull();
});

test('loadState — returns null on wrong schemaVersion (forward-compat)', async () => {
  const path = join(dir, 'state.json');
  await Bun.write(path, JSON.stringify({ ...sample, schemaVersion: 99 }));
  expect(await store.loadState()).toBeNull();
});
