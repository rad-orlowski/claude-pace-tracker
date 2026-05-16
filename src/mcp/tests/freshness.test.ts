import { test, expect } from 'bun:test';
import { classifyFreshness, type FreshnessInput } from '../src/freshness';

const base: Omit<FreshnessInput, 'lastStateAt' | 'lastSeenAt'> = {
  now:           new Date('2026-05-16T14:00:00.000Z'),
  warnAfterMin:  30,
  errorAfterMin: 120,
};

test('no-data when lastStateAt is null', () => {
  const r = classifyFreshness({ ...base, lastStateAt: null, lastSeenAt: null });
  expect(r.freshness).toBe('no-data');
  expect(r.dataAgeMin).toBeNull();
});

test('fresh when state is recent', () => {
  const r = classifyFreshness({
    ...base,
    lastStateAt: new Date('2026-05-16T13:45:00.000Z'),
    lastSeenAt:  new Date('2026-05-16T13:59:30.000Z'),
  });
  expect(r.freshness).toBe('fresh');
  expect(r.dataAgeMin).toBe(15);
  expect(r.liveAgeSec).toBe(30);
});

test('stale-warning past warnAfterMin but before errorAfterMin', () => {
  const r = classifyFreshness({
    ...base,
    lastStateAt: new Date('2026-05-16T13:10:00.000Z'),
    lastSeenAt:  new Date('2026-05-16T13:10:00.000Z'),
  });
  expect(r.freshness).toBe('stale-warning');
  expect(r.dataAgeMin).toBe(50);
});

test('stale-error past errorAfterMin', () => {
  const r = classifyFreshness({
    ...base,
    lastStateAt: new Date('2026-05-16T11:30:00.000Z'),
    lastSeenAt:  null,
  });
  expect(r.freshness).toBe('stale-error');
  expect(r.dataAgeMin).toBe(150);
  expect(r.liveAgeSec).toBeNull();
});

test('liveAgeSec is independent of dataAgeMin', () => {
  const r = classifyFreshness({
    ...base,
    lastStateAt: new Date('2026-05-16T13:00:00.000Z'),
    lastSeenAt:  new Date('2026-05-16T13:59:55.000Z'),
  });
  expect(r.freshness).toBe('stale-warning');
  expect(r.dataAgeMin).toBe(60);
  expect(r.liveAgeSec).toBe(5);
});
