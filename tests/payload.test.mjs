import { test, expect } from 'bun:test';
import { buildPushPayload } from '../src/userscript/payload.js';

const CFG = { activeStartH: 7, activeEndH: 20, sleepStartH: 23, bandWeekly: 2, bandSession: 5 };

function mkJson() {
  const future = new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString();
  const sess   = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
  return {
    seven_day:        { utilization: 41, resets_at: future },
    seven_day_sonnet: { utilization: 38, resets_at: future },
    seven_day_opus:   { utilization: 12, resets_at: future },
    five_hour:        { utilization: 20, resets_at: sess   },
  };
}

test('buildPushPayload returns schemaVersion 1 with raw + computed + situation', () => {
  const p = buildPushPayload(mkJson(), Date.now(), CFG);
  expect(p).not.toBeNull();
  expect(p.schemaVersion).toBe(1);
  expect(p.raw.seven_day.utilization).toBe(41);
  expect(p.raw.five_hour.utilization).toBe(20);
  expect(['active', 'bonus', 'sleep']).toContain(p.computed.window);
  expect(typeof p.computed.session.deltaPp).toBe('number');
  expect(typeof p.computed.allWeekly.elapsedPct).toBe('number');
  expect(p.situation.key.length).toBeGreaterThan(0);
  expect(typeof p.situation.message).toBe('string');
});

test('trend enum is one of over/under/on-track/sleep/catch-up', () => {
  const p = buildPushPayload(mkJson(), Date.now(), CFG);
  const allowed = new Set(['over', 'under', 'on-track', 'sleep', 'catch-up']);
  expect(allowed.has(p.computed.session.trend)).toBe(true);
  expect(allowed.has(p.computed.allWeekly.trend)).toBe(true);
  expect(allowed.has(p.computed.allDaily.trend)).toBe(true);
  expect(allowed.has(p.computed.sonnetWeekly.trend)).toBe(true);
  expect(allowed.has(p.computed.sonnetDaily.trend)).toBe(true);
  expect(allowed.has(p.situation.trend)).toBe(true);
});

test('returns null when /usage JSON is incomplete', () => {
  expect(buildPushPayload(null, Date.now(), CFG)).toBeNull();
  expect(buildPushPayload({ five_hour: { utilization: 10, resets_at: 'x' } }, Date.now(), CFG)).toBeNull();
});
