import { test, expect } from 'bun:test';
import { isValidStatePayload, type StatePayload } from '../src/payload';

const fixture: StatePayload = {
  schemaVersion: 1,
  pushedAt: '2026-05-16T14:23:11.000Z',
  raw: {
    seven_day:        { utilization: 41.2, resets_at: '2026-05-23T00:00:00.000Z' },
    seven_day_sonnet: { utilization: 38.7, resets_at: '2026-05-23T00:00:00.000Z' },
    seven_day_opus:   { utilization: 12.1, resets_at: '2026-05-23T00:00:00.000Z' },
    five_hour:        { utilization: 23.4, resets_at: '2026-05-16T18:00:00.000Z' },
  },
  computed: {
    window: 'active',
    resetInH: 71.4,
    daysLeft: 3,
    session:      { utilizationPct: 23.4, deltaPp: -2.1, elapsedPct: 25.5, trend: 'on-track' },
    allWeekly:    { utilizationPct: 41.2, deltaPp:  4.8, elapsedPct: 36.4, trend: 'over' },
    allDaily:     { deltaPp: 1.2,  trend: 'on-track' },
    sonnetWeekly: { utilizationPct: 38.7, deltaPp:  2.0, elapsedPct: 36.4, trend: 'on-track' },
    sonnetDaily:  { deltaPp: -0.5, trend: 'on-track' },
    opusPct: 12.1,
  },
  situation: {
    key: 'ALL_OVER',
    params: { allWDp: 5 },
    message: 'All-models weekly is +5% ahead.',
    trend: 'over',
  },
};

test('isValidStatePayload accepts a well-formed payload', () => {
  expect(isValidStatePayload(fixture)).toBe(true);
});

test('isValidStatePayload rejects null and non-objects', () => {
  expect(isValidStatePayload(null)).toBe(false);
  expect(isValidStatePayload('nope')).toBe(false);
  expect(isValidStatePayload(123)).toBe(false);
});

test('isValidStatePayload rejects wrong schemaVersion', () => {
  expect(isValidStatePayload({ ...fixture, schemaVersion: 2 })).toBe(false);
});

test('isValidStatePayload rejects missing required raw bucket', () => {
  const bad = { ...fixture, raw: { ...fixture.raw, five_hour: undefined } };
  expect(isValidStatePayload(bad)).toBe(false);
});

test('isValidStatePayload rejects unknown trend enum value', () => {
  const bad = {
    ...fixture,
    situation: { ...fixture.situation, trend: 'flying' as any },
  };
  expect(isValidStatePayload(bad)).toBe(false);
});
