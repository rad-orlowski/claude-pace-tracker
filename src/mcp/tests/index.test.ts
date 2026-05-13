/**
 * Tests for the MCP tool handler logic defined in src/index.ts.
 *
 * The tool handlers are extracted as pure async functions so they can be
 * tested without spawning a real MCP server or touching the network.
 */
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeStore } from '../src/store';
import { getPaceStatsHandler, getSituationHandler } from '../src/index';

let dir: string;
let store: ReturnType<typeof makeStore>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pace-index-'));
  store = makeStore(join(dir, 'config.json'), join(dir, 'stats.json'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

// ─── get_pace_stats ──────────────────────────────────────────────────────────

test('get_pace_stats — no stats returns "No data yet" text', async () => {
  const result = await getPaceStatsHandler(store);
  const text = result.content[0].text as string;
  expect(JSON.parse(text).error).toMatch(/No data yet/);
});

test('get_pace_stats — expired credentials returns error with reconnect message', async () => {
  await store.saveStats({
    updatedAt: new Date().toISOString(),
    credentialsStatus: 'expired',
    situation: null,
    message: null,
    weekly: { deltaPp: 0, utilizationPct: 50, elapsedPct: 50 },
    session: { deltaPp: 0, utilizationPct: 10 },
  });

  const result = await getPaceStatsHandler(store);
  expect(result.isError).toBe(true);
  const text = result.content[0].text as string;
  expect(JSON.parse(text).error).toMatch(/expired/i);
  expect(JSON.parse(text).error).toMatch(/Reconnect/i);
});

test('get_pace_stats — missing credentials returns error with connect message', async () => {
  await store.saveStats({
    updatedAt: new Date().toISOString(),
    credentialsStatus: 'missing',
    situation: null,
    message: null,
    weekly: { deltaPp: 0, utilizationPct: 0, elapsedPct: 0 },
    session: { deltaPp: 0, utilizationPct: 0 },
  });

  const result = await getPaceStatsHandler(store);
  expect(result.isError).toBe(true);
  const text = result.content[0].text as string;
  expect(JSON.parse(text).error).toMatch(/Connect/i);
});

test('get_pace_stats — valid stats returns JSON stats object', async () => {
  const stats = {
    updatedAt: '2026-05-13T10:00:00.000Z',
    credentialsStatus: 'valid' as const,
    situation: 'ALL_CLEAR',
    message: 'All pace indicators on track.',
    weekly: { deltaPp: -2, utilizationPct: 48, elapsedPct: 50 },
    session: { deltaPp: 1, utilizationPct: 11 },
  };
  await store.saveStats(stats);

  const result = await getPaceStatsHandler(store);
  expect(result.isError).toBeFalsy();
  const parsed = JSON.parse(result.content[0].text as string);
  expect(parsed.credentialsStatus).toBe('valid');
  expect(parsed.situation).toBe('ALL_CLEAR');
  expect(parsed.weekly.deltaPp).toBe(-2);
});

// ─── get_situation ────────────────────────────────────────────────────────────

test('get_situation — no stats returns "No data yet" message', async () => {
  const result = await getSituationHandler(store);
  expect(result.content[0].text).toMatch(/No data yet/);
});

test('get_situation — expired credentials returns isError with status message', async () => {
  await store.saveStats({
    updatedAt: new Date().toISOString(),
    credentialsStatus: 'expired',
    situation: null,
    message: null,
    weekly: { deltaPp: 0, utilizationPct: 50, elapsedPct: 50 },
    session: { deltaPp: 0, utilizationPct: 10 },
  });

  const result = await getSituationHandler(store);
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toMatch(/expired/i);
});

test('get_situation — valid stats returns situation and message', async () => {
  await store.saveStats({
    updatedAt: '2026-05-13T10:00:00.000Z',
    credentialsStatus: 'valid',
    situation: 'ALL_CLEAR',
    message: 'All pace indicators on track.',
    weekly: { deltaPp: -2, utilizationPct: 48, elapsedPct: 50 },
    session: { deltaPp: 1, utilizationPct: 11 },
  });

  const result = await getSituationHandler(store);
  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('ALL_CLEAR');
  expect(result.content[0].text).toContain('All pace indicators on track.');
});
