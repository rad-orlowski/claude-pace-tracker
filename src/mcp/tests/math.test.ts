import { test, expect } from 'bun:test';
import {
  elapsedPctOf, deltaPpOf, severityOf, timeWindowOf,
  activeHoursBetween, activeElapsedPctOf, frozenExpectedPctOf, todayEndExpectedPctOf,
} from '../src/math';

const HOUR = 3_600_000;

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

function ld(year: number, month: number, day: number, hour: number, min = 0) {
  return new Date(year, month - 1, day, hour, min);
}

test('timeWindowOf — 10am is active',               () => expect(timeWindowOf(ld(2026, 1, 7, 10))).toBe('active'));
test('timeWindowOf — exactly 7am is active',        () => expect(timeWindowOf(ld(2026, 1, 7, 7, 0))).toBe('active'));
test('timeWindowOf — exactly 8pm (20:00) is bonus', () => expect(timeWindowOf(ld(2026, 1, 7, 20, 0))).toBe('bonus'));
test('timeWindowOf — 9pm is bonus',                 () => expect(timeWindowOf(ld(2026, 1, 7, 21))).toBe('bonus'));
test('timeWindowOf — exactly 11pm is sleep',        () => expect(timeWindowOf(ld(2026, 1, 7, 23, 0))).toBe('sleep'));
test('timeWindowOf — 3am is sleep',                 () => expect(timeWindowOf(ld(2026, 1, 7, 3))).toBe('sleep'));

const T = {
  periodMs:    7 * 24 * 3600 * 1000,
  resetsAt:    new Date(2026, 0, 12,  0, 0, 0).getTime(),
  mon8am:      new Date(2026, 0,  5,  8, 0, 0).getTime(),
  mon8pm:      new Date(2026, 0,  5, 20, 0, 0).getTime(),
  mon9pm:      new Date(2026, 0,  5, 21, 0, 0).getTime(),
  tue3am:      new Date(2026, 0,  6,  3, 0, 0).getTime(),
  periodStart: new Date(2026, 0,  5,  0, 0, 0).getTime(),
};

test('activeElapsedPctOf — at period start = 0', () =>
  expect(activeElapsedPctOf(T.periodStart, T.resetsAt, T.periodMs)).toBe(0));

test('activeElapsedPctOf — 1h into Mon active window', () => {
  const result   = activeElapsedPctOf(T.mon8am, T.resetsAt, T.periodMs);
  const expected = (1 / 91) * 100;
  expect(Math.abs(result - expected)).toBeLessThan(0.01);
});

test('activeElapsedPctOf — does not advance during sleep', () => {
  const atMon8pm = activeElapsedPctOf(T.mon8pm, T.resetsAt, T.periodMs);
  const atTue3am = activeElapsedPctOf(T.tue3am, T.resetsAt, T.periodMs);
  expect(atMon8pm.toFixed(6)).toBe(atTue3am.toFixed(6));
});

test('activeElapsedPctOf — at period end = 100', () =>
  expect(activeElapsedPctOf(T.resetsAt, T.resetsAt, T.periodMs)).toBe(100));

test('frozenExpectedPctOf — at 9pm Mon returns same as at 8pm Mon', () => {
  const frozen = frozenExpectedPctOf(T.mon9pm, T.resetsAt, T.periodMs);
  const at8pm  = activeElapsedPctOf(T.mon8pm, T.resetsAt, T.periodMs);
  expect(frozen.toFixed(6)).toBe(at8pm.toFixed(6));
});

test('todayEndExpectedPctOf — during active hours returns expected at 8pm today', () => {
  const result   = todayEndExpectedPctOf(T.mon8am, T.resetsAt, T.periodMs);
  const expected = activeElapsedPctOf(T.mon8pm, T.resetsAt, T.periodMs);
  expect(result.toFixed(6)).toBe(expected.toFixed(6));
});
