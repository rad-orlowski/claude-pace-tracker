import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeStore } from '../src/store';
import type { SidecarState } from '../src/http';
import type { StatePayload } from '../src/payload';
import { getPaceStatsHandler, getSituationHandler } from '../src/index';

let dir: string;
let store: ReturnType<typeof makeStore>;
let state: SidecarState;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pace-handlers-'));
  store = makeStore(join(dir, 'state.json'));
  state = { lastState: null, lastStateAt: null, lastSeenAt: null };
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
    five_hour:        { utilization: 20, resets_at: '2026-05-16T18:00:00.000Z' },
  },
  computed: {
    window: 'active', resetInH: 71, daysLeft: 3,
    session:      { utilizationPct: 20, deltaPp: -2, elapsedPct: 22, trend: 'on-track' },
    allWeekly:    { utilizationPct: 40, deltaPp:  4, elapsedPct: 36, trend: 'over' },
    allDaily:     { deltaPp: 1, trend: 'on-track' },
    sonnetWeekly: { utilizationPct: 35, deltaPp: -1, elapsedPct: 36, trend: 'on-track' },
    sonnetDaily:  { deltaPp: 0, trend: 'on-track' },
  },
  situation: { key: 'ALL_OVER', params: { allWDp: 4 }, message: 'All-models +4%.', trend: 'over' },
};

test('get_pace_stats — no data', async () => {
  const r = await getPaceStatsHandler(state);
  const parsed = JSON.parse(r.content[0].text as string);
  expect(parsed.status.freshness).toBe('no-data');
  expect(parsed.payload).toBeNull();
});

test('get_pace_stats — fresh state', async () => {
  state.lastState = sample;
  state.lastStateAt = new Date();
  state.lastSeenAt = new Date();
  const r = await getPaceStatsHandler(state);
  expect(r.isError).toBeFalsy();
  const parsed = JSON.parse(r.content[0].text as string);
  expect(parsed.status.freshness).toBe('fresh');
  expect(parsed.payload.situation.key).toBe('ALL_OVER');
  expect(parsed.payload.computed.allWeekly.deltaPp).toBe(4);
});

test('get_pace_stats — past hard threshold returns isError but still includes payload', async () => {
  state.lastState = sample;
  state.lastStateAt = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3h ago
  state.lastSeenAt = state.lastStateAt;
  const r = await getPaceStatsHandler(state);
  expect(r.isError).toBe(true);
  const parsed = JSON.parse(r.content[0].text as string);
  expect(parsed.status.freshness).toBe('stale-error');
  expect(parsed.payload).not.toBeNull();
});

test('get_situation — no data', async () => {
  const r = await getSituationHandler(state);
  expect((r.content[0].text as string)).toMatch(/no data/i);
});

test('get_situation — fresh state includes message, trend, and age suffix', async () => {
  state.lastState = sample;
  state.lastStateAt = new Date();
  state.lastSeenAt = new Date();
  const r = await getSituationHandler(state);
  expect(r.isError).toBeFalsy();
  const text = r.content[0].text as string;
  expect(text).toContain('ALL_OVER');
  expect(text).toContain('All-models +4%.');
  expect(text).toContain('trend: over');
  expect(text).toMatch(/\[data: \d+m ago\]/);
});

test('get_situation — stale-error includes refresh hint and isError', async () => {
  state.lastState = sample;
  state.lastStateAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  state.lastSeenAt = null;
  const r = await getSituationHandler(state);
  expect(r.isError).toBe(true);
  const text = r.content[0].text as string;
  expect(text).toMatch(/stale:/i);
  expect(text).toMatch(/claude\.ai\/settings\/usage/);
});
