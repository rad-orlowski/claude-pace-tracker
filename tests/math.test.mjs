import { test, expect } from 'bun:test';
import {
  elapsedPctOf, deltaPpOf, severityOf, timeWindowOf,
  activeHoursBetween, activeElapsedPctOf, frozenExpectedPctOf, todayEndExpectedPctOf,
} from '../src/userscript/math.js';

const HOUR = 3_600_000;

// ── elapsedPctOf ─────────────────────────────────────────────────────────────

test('elapsedPctOf — at start is 0', () => {
  const periodMs = 5 * HOUR;
  const resetsAt = new Date('2026-04-26T05:00:00Z').getTime();
  expect(elapsedPctOf(resetsAt - periodMs, resetsAt, periodMs)).toBe(0);
});

test('elapsedPctOf — at end is 100', () => {
  const periodMs = 5 * HOUR;
  const resetsAt = new Date('2026-04-26T05:00:00Z').getTime();
  expect(elapsedPctOf(resetsAt, resetsAt, periodMs)).toBe(100);
});

test('elapsedPctOf — at midpoint is 50', () => {
  const periodMs = 5 * HOUR;
  const resetsAt = new Date('2026-04-26T05:00:00Z').getTime();
  expect(elapsedPctOf(resetsAt - periodMs / 2, resetsAt, periodMs)).toBeCloseTo(50);
});

test('elapsedPctOf clamps below 0', () => {
  const periodMs = 5 * HOUR;
  const resetsAt = new Date('2026-04-26T05:00:00Z').getTime();
  expect(elapsedPctOf(resetsAt - periodMs - HOUR, resetsAt, periodMs)).toBe(0);
});

test('elapsedPctOf clamps above 100', () => {
  const periodMs = 5 * HOUR;
  const resetsAt = new Date('2026-04-26T05:00:00Z').getTime();
  expect(elapsedPctOf(resetsAt + HOUR, resetsAt, periodMs)).toBe(100);
});

// ── deltaPpOf / severityOf ────────────────────────────────────────────────────

test('deltaPpOf returns util minus elapsed', () => {
  expect(deltaPpOf(72, 40)).toBe(32);
  expect(deltaPpOf(10, 50)).toBe(-40);
});

test('severityOf classifies with band', () => {
  expect(severityOf(0,    5)).toBe('neutral');
  expect(severityOf(5,    5)).toBe('neutral');
  expect(severityOf(5.1,  5)).toBe('over');
  expect(severityOf(-5,   5)).toBe('neutral');
  expect(severityOf(-5.1, 5)).toBe('under');
});

// ── timeWindowOf ─────────────────────────────────────────────────────────────

function ld(year, month, day, hour, min = 0) {
  return new Date(year, month - 1, day, hour, min);
}

test('timeWindowOf — 10am is active',            () => expect(timeWindowOf(ld(2026, 1, 7, 10))).toBe('active'));
test('timeWindowOf — exactly 7am is active',     () => expect(timeWindowOf(ld(2026, 1, 7, 7, 0))).toBe('active'));
test('timeWindowOf — exactly 8pm (20:00) is bonus', () => expect(timeWindowOf(ld(2026, 1, 7, 20, 0))).toBe('bonus'));
test('timeWindowOf — 9pm is bonus',              () => expect(timeWindowOf(ld(2026, 1, 7, 21))).toBe('bonus'));
test('timeWindowOf — exactly 11pm is sleep',     () => expect(timeWindowOf(ld(2026, 1, 7, 23, 0))).toBe('sleep'));
test('timeWindowOf — 3am is sleep',              () => expect(timeWindowOf(ld(2026, 1, 7, 3))).toBe('sleep'));

// ── activeElapsedPctOf ────────────────────────────────────────────────────────

const T = {
  periodMs:    7 * 24 * 3600 * 1000,
  resetsAt:    new Date(2026, 0, 12,  0, 0, 0).getTime(),
  periodStart: new Date(2026, 0,  5,  0, 0, 0).getTime(),
  mon8am:      new Date(2026, 0,  5,  8, 0, 0).getTime(),
  mon8pm:      new Date(2026, 0,  5, 20, 0, 0).getTime(),
  mon9pm:      new Date(2026, 0,  5, 21, 0, 0).getTime(),
  tue3am:      new Date(2026, 0,  6,  3, 0, 0).getTime(),
};

test('activeElapsedPctOf — at period start = 0', () => {
  expect(activeElapsedPctOf(T.periodStart, T.resetsAt, T.periodMs)).toBe(0);
});

test('activeElapsedPctOf — 1h into Mon active window = 1/91 of total', () => {
  const result   = activeElapsedPctOf(T.mon8am, T.resetsAt, T.periodMs);
  const expected = (1 / 91) * 100;
  expect(Math.abs(result - expected)).toBeLessThan(0.01);
});

test('activeElapsedPctOf — does not advance during sleep (8pm Mon = 3am Tue)', () => {
  const atMon8pm = activeElapsedPctOf(T.mon8pm, T.resetsAt, T.periodMs);
  const atTue3am = activeElapsedPctOf(T.tue3am, T.resetsAt, T.periodMs);
  expect(atMon8pm.toFixed(6)).toBe(atTue3am.toFixed(6));
});

test('activeElapsedPctOf — at period end = 100', () => {
  expect(activeElapsedPctOf(T.resetsAt, T.resetsAt, T.periodMs)).toBe(100);
});

// ── frozenExpectedPctOf ───────────────────────────────────────────────────────

test('frozenExpectedPctOf — at 9pm Mon returns same as at 8pm Mon', () => {
  const frozen = frozenExpectedPctOf(T.mon9pm, T.resetsAt, T.periodMs);
  const at8pm  = activeElapsedPctOf(T.mon8pm, T.resetsAt, T.periodMs);
  expect(frozen.toFixed(6)).toBe(at8pm.toFixed(6));
});

test('frozenExpectedPctOf — at 3am Tue returns same as 8pm Mon', () => {
  const frozen   = frozenExpectedPctOf(T.tue3am, T.resetsAt, T.periodMs);
  const at8pmMon = activeElapsedPctOf(T.mon8pm, T.resetsAt, T.periodMs);
  expect(frozen.toFixed(6)).toBe(at8pmMon.toFixed(6));
});

// ── todayEndExpectedPctOf ─────────────────────────────────────────────────────

test('todayEndExpectedPctOf — during active hours returns expected at 8pm today', () => {
  const result   = todayEndExpectedPctOf(T.mon8am, T.resetsAt, T.periodMs);
  const expected = activeElapsedPctOf(T.mon8pm, T.resetsAt, T.periodMs);
  expect(result.toFixed(6)).toBe(expected.toFixed(6));
});

test('todayEndExpectedPctOf — during bonus hours returns same as already-passed 8pm today', () => {
  const result   = todayEndExpectedPctOf(T.mon9pm, T.resetsAt, T.periodMs);
  const expected = activeElapsedPctOf(T.mon8pm, T.resetsAt, T.periodMs);
  expect(result.toFixed(6)).toBe(expected.toFixed(6));
});

import { buildBarGradient, buildWeeklyBar, BAR_COLORS } from '../src/userscript/ui/components/bar.js';

const periodStart = new Date(2026, 0, 5, 0, 0, 0).getTime();
const periodMs    = 7 * 24 * 3600 * 1000;

test('buildBarGradient — returns a CSS linear-gradient string', () => {
  const g = buildBarGradient(periodStart, periodMs);
  expect(g.startsWith('linear-gradient(to right,')).toBe(true);
  expect(g.endsWith('100%)')).toBe(true);
});

test('buildBarGradient — contains all three colours', () => {
  const g = buildBarGradient(periodStart, periodMs);
  expect(g).toContain(BAR_COLORS.active);
  expect(g).toContain(BAR_COLORS.bonus);
  expect(g).toContain(BAR_COLORS.sleep);
});

test('buildBarGradient — starts with sleep (midnight is in sleep window)', () => {
  expect(buildBarGradient(periodStart, periodMs)).toContain(`${BAR_COLORS.sleep} 0.000%`);
});

test('buildWeeklyBar — returns linear-gradient starting at 0% ending at 100%', () => {
  const g = buildWeeklyBar();
  expect(g.startsWith('linear-gradient(to right,')).toBe(true);
  expect(g.endsWith('100%)')).toBe(true);
  expect(g).toContain(BAR_COLORS.active);
  expect(g).toContain(BAR_COLORS.activeAlt);
});

test('buildWeeklyBar — custom days param (5)', () => {
  const g = buildWeeklyBar(5);
  expect(g.startsWith('linear-gradient(to right,')).toBe(true);
  expect(g.endsWith('100%)')).toBe(true);
});
