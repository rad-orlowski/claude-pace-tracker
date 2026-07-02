import { test, expect } from 'bun:test';
import { normalizeUsage, keyForLimit } from '../src/userscript/usage-normalize.js';

// Trimmed from a real /usage response: scoped per-model weekly data lives in
// limits[], the legacy seven_day_* keys are null, five_hour/seven_day still
// carry top-level values.
const realish = {
  five_hour: { utilization: 7.0, resets_at: '2026-07-02T13:30:00.064568+00:00' },
  seven_day: { utilization: 6.0, resets_at: '2026-07-08T04:00:00.064592+00:00' },
  seven_day_sonnet: null,
  seven_day_opus: null,
  seven_day_omelette: null,
  limits: [
    { kind: 'session',       percent: 7, resets_at: '2026-07-02T13:30:00.064568+00:00', scope: null },
    { kind: 'weekly_all',    percent: 6, resets_at: '2026-07-08T04:00:00.064592+00:00', scope: null },
    { kind: 'weekly_scoped', percent: 3, resets_at: '2026-07-08T04:00:00.064944+00:00', scope: { model: { id: null, display_name: 'Fable' } } },
  ],
};

test('projects a weekly_scoped Fable limit into seven_day_fable', () => {
  const out = normalizeUsage(realish);
  expect(out.seven_day_fable).toEqual({ utilization: 3, resets_at: '2026-07-08T04:00:00.064944+00:00' });
});

test('legacy top-level values win over limits[] (float precision kept)', () => {
  const out = normalizeUsage(realish);
  expect(out.five_hour.utilization).toBe(7.0); // not overwritten by limits percent
  expect(out.seven_day.utilization).toBe(6.0);
});

test('null legacy scoped keys are treated as fillable', () => {
  const out = normalizeUsage({
    seven_day_sonnet: null,
    limits: [
      { kind: 'weekly_scoped', percent: 12, resets_at: '2026-07-08T04:00:00Z', scope: { model: { display_name: 'Sonnet' } } },
    ],
  });
  expect(out.seven_day_sonnet).toEqual({ utilization: 12, resets_at: '2026-07-08T04:00:00Z' });
});

test('input without a limits[] array is returned unchanged (old API)', () => {
  const legacy = { five_hour: { utilization: 5, resets_at: 'x' }, seven_day_sonnet: { utilization: 2, resets_at: 'y' } };
  expect(normalizeUsage(legacy)).toBe(legacy);
});

test('scoped limit with no display_name is skipped', () => {
  expect(keyForLimit({ kind: 'weekly_scoped', scope: { model: { display_name: null } } })).toBeNull();
  expect(keyForLimit({ kind: 'session' })).toBe('five_hour');
  expect(keyForLimit({ kind: 'weekly_all' })).toBe('seven_day');
  expect(keyForLimit({ kind: 'weekly_scoped', scope: { model: { display_name: 'Fable' } } })).toBe('seven_day_fable');
});

test('missing percent or resets_at does not create a partial bucket', () => {
  const out = normalizeUsage({
    limits: [{ kind: 'weekly_scoped', percent: null, resets_at: '2026-07-08T04:00:00Z', scope: { model: { display_name: 'Fable' } } }],
  });
  expect(out.seven_day_fable).toBeUndefined();
});
