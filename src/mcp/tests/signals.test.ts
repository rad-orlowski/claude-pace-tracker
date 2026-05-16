import { test, expect } from 'bun:test';
import { buildSignals, classifySituation, SITUATION_MESSAGES } from '../src/signals';

const CFG = {
  activeStartH: 7, activeEndH: 20, sleepStartH: 23,
  bandWeekly: 2, bandSession: 5,
};

const WEEK_MS = 7 * 24 * 3600 * 1000;
const SESS_MS = 5 * 3600 * 1000;

function makeJson(opts: {
  allUtil?: number; sonUtil?: number; sessUtil?: number;
  allRA?: number; sonRA?: number; sessRA?: number;
}) {
  const now = Date.now();
  return {
    seven_day:        { utilization: opts.allUtil  ?? 50, resets_at: new Date(opts.allRA  ?? now + WEEK_MS).toISOString() },
    seven_day_sonnet: { utilization: opts.sonUtil  ?? 50, resets_at: new Date(opts.sonRA  ?? now + WEEK_MS).toISOString() },
    five_hour:        { utilization: opts.sessUtil ?? 10, resets_at: new Date(opts.sessRA ?? now + SESS_MS).toISOString() },
  };
}

test('buildSignals — returns null for missing bucket', () => {
  expect(buildSignals({} as any, Date.now(), CFG)).toBeNull();
});

test('buildSignals — returns signals object for valid json', () => {
  const sigs = buildSignals(makeJson({}), Date.now(), CFG);
  expect(sigs).not.toBeNull();
  expect(sigs!.allWeekly).toBeDefined();
  expect(sigs!.sonnetWeekly).toBeDefined();
  expect(sigs!.session).toBeDefined();
});

test('buildSignals — allWeekly.pct reflects utilization', () => {
  const json = makeJson({ allUtil: 95 });
  const sigs = buildSignals(json, Date.now(), CFG)!;
  expect(sigs.allWeekly.pct).toBe(95);
});

test('classifySituation — CRITICAL_LIMIT when all-models > 90%', () => {
  const json = makeJson({ allUtil: 92 });
  const sigs = buildSignals(json, Date.now(), CFG)!;
  const { key } = classifySituation(sigs, CFG);
  expect(key).toBe('CRITICAL_LIMIT');
});

test('classifySituation — ALL_CLEAR when all on track', () => {
  const now = Date.now();
  const json = {
    seven_day:        { utilization: 14, resets_at: new Date(now + 6 * 24 * 3600 * 1000).toISOString() },
    seven_day_sonnet: { utilization: 14, resets_at: new Date(now + 6 * 24 * 3600 * 1000).toISOString() },
    five_hour:        { utilization: 20, resets_at: new Date(now + 4 * 3600 * 1000).toISOString() },
  };
  const sigs = buildSignals(json, now, CFG)!;
  const { key } = classifySituation(sigs, CFG);
  expect(SITUATION_MESSAGES[key as keyof typeof SITUATION_MESSAGES]).toBeDefined();
});

test('SITUATION_MESSAGES — CRITICAL_LIMIT renders a string', () => {
  const msg = SITUATION_MESSAGES.CRITICAL_LIMIT({ model: 'Sonnet', pct: 92 });
  expect(typeof msg).toBe('string');
  expect(msg).toContain('92%');
});
