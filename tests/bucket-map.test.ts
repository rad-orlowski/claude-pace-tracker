import { test, expect } from 'bun:test';
import { BUCKET_MAP, PERIOD_LEN_MS, titleToKey, NEUTRAL_BAND_BY_KEY } from '../src/userscript/constants.js';

test('BUCKET_MAP contains the documented JSON keys', () => {
  expect(BUCKET_MAP.five_hour).toEqual({ title: 'Current session', periodMs: 5 * 60 * 60 * 1000 });
  expect(BUCKET_MAP.seven_day).toEqual({ title: 'All models',      periodMs: 7 * 24 * 60 * 60 * 1000 });
  expect(BUCKET_MAP.seven_day_sonnet.periodMs).toBe(7 * 24 * 60 * 60 * 1000);
});

test('BUCKET_MAP excludes seven_day_omelette (Claude Design — not graphed)', () => {
  expect((BUCKET_MAP as any).seven_day_omelette).toBeUndefined();
});

test('PERIOD_LEN_MS is derived from BUCKET_MAP', () => {
  expect(PERIOD_LEN_MS.five_hour).toBe(BUCKET_MAP.five_hour.periodMs);
  expect(PERIOD_LEN_MS.seven_day_sonnet).toBe(BUCKET_MAP.seven_day_sonnet.periodMs);
});

test('titleToKey reverses BUCKET_MAP', () => {
  expect(titleToKey(BUCKET_MAP.five_hour.title)).toBe('five_hour');
  expect(titleToKey(BUCKET_MAP.seven_day_sonnet.title)).toBe('seven_day_sonnet');
  expect(titleToKey('Unknown row title')).toBeNull();
});

test('NEUTRAL_BAND_BY_KEY — weekly keys are tighter than session', () => {
  expect(NEUTRAL_BAND_BY_KEY.five_hour).toBeGreaterThan(NEUTRAL_BAND_BY_KEY.seven_day);
  expect(NEUTRAL_BAND_BY_KEY.seven_day).toBe(2);
  expect(NEUTRAL_BAND_BY_KEY.seven_day_sonnet).toBe(2);
});
