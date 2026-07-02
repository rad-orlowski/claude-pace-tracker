import { test, expect } from 'bun:test';
import { BUCKET_MAP, PERIOD_LEN_MS, titleToKey, WEEK_MS } from '../src/userscript/constants.js';

test('BUCKET_MAP contains the documented JSON keys', () => {
  expect(BUCKET_MAP.five_hour).toEqual({ title: 'Current session', periodMs: 5 * 60 * 60 * 1000 });
  expect(BUCKET_MAP.seven_day).toEqual({ title: 'All models',      periodMs: WEEK_MS });
  expect(BUCKET_MAP.seven_day_sonnet.periodMs).toBe(WEEK_MS);
  expect(BUCKET_MAP.seven_day_fable).toEqual({ title: 'Fable', periodMs: WEEK_MS });
});

test('WEEK_MS is 7 days in ms', () => {
  expect(WEEK_MS).toBe(7 * 24 * 60 * 60 * 1000);
});

test('BUCKET_MAP excludes seven_day_omelette (Claude Design — not graphed)', () => {
  expect((BUCKET_MAP as any).seven_day_omelette).toBeUndefined();
});

test('PERIOD_LEN_MS is derived from BUCKET_MAP', () => {
  expect(PERIOD_LEN_MS.five_hour).toBe(BUCKET_MAP.five_hour.periodMs);
  expect(PERIOD_LEN_MS.seven_day_sonnet).toBe(BUCKET_MAP.seven_day_sonnet.periodMs);
  expect(PERIOD_LEN_MS.seven_day_fable).toBe(BUCKET_MAP.seven_day_fable.periodMs);
});

test('titleToKey reverses BUCKET_MAP', () => {
  expect(titleToKey(BUCKET_MAP.five_hour.title)).toBe('five_hour');
  expect(titleToKey(BUCKET_MAP.seven_day_sonnet.title)).toBe('seven_day_sonnet');
  expect(titleToKey('Fable')).toBe('seven_day_fable');
  expect(titleToKey('Unknown row title')).toBeNull();
});
