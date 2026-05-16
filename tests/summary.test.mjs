import { test, expect } from 'bun:test';
import { buildSignals, classifySituation, SITUATION_MESSAGES } from '../src/userscript/signals.js';

const periodMs = 7 * 24 * 3600 * 1000;
const sessMs   = 5 * 3600 * 1000;
const resetsAt = new Date(2026, 0, 12, 0, 0, 0).getTime();
const wed9am   = new Date(2026, 0, 7,  9, 0, 0).getTime();
const wed9pm   = new Date(2026, 0, 7, 21, 0, 0).getTime();
const wed1am   = new Date(2026, 0, 7,  1, 0, 0).getTime();

const cfg = { activeStartH: 7, activeEndH: 20, sleepStartH: 23, bandWeekly: 2, bandSession: 5 };

function makeJson(allUtil, sonnetUtil, sessUtil, now = wed9am) {
  const sessResetsAt = now + sessMs;
  return {
    seven_day:        { utilization: allUtil,    resets_at: new Date(resetsAt).toISOString() },
    seven_day_sonnet: { utilization: sonnetUtil, resets_at: new Date(resetsAt).toISOString() },
    five_hour:        { utilization: sessUtil,   resets_at: new Date(sessResetsAt).toISOString() },
  };
}

function makeSignals({
  sessDP = 0, allWPct = 50, allWDP = 0, allDDP = 0,
  sonWPct = 50, sonWDP = 0, sonDDP = 0,
  win = 'active', resetInH = 48, daysLeft = 4,
} = {}) {
  const bW = cfg.bandWeekly, bS = cfg.bandSession;
  const sev = (dp, b) => dp > b ? 'over' : dp < -b ? 'under' : 'neutral';
  return {
    session:      { dp: sessDP,  sev: sev(sessDP, bS) },
    allWeekly:    { dp: allWDP,  sev: sev(allWDP, bW), pct: allWPct },
    allDaily:     { dp: allDDP,  sev: sev(allDDP, bW) },
    sonnetWeekly: { dp: sonWDP,  sev: sev(sonWDP, bW), pct: sonWPct },
    sonnetDaily:  { dp: sonDDP,  sev: sev(sonDDP, bW) },
    window: win, resetInH, daysLeft,
  };
}

// ── buildSignals ──────────────────────────────────────────────────────────────

test('buildSignals — returns null when bucket missing', () => {
  expect(buildSignals({}, wed9am, cfg)).toBeNull();
});

test('buildSignals — returns null when utilization missing', () => {
  const json = {
    seven_day:        { resets_at: new Date(resetsAt).toISOString() },
    seven_day_sonnet: { utilization: 40, resets_at: new Date(resetsAt).toISOString() },
    five_hour:        { utilization: 30, resets_at: new Date(wed9am + sessMs).toISOString() },
  };
  expect(buildSignals(json, wed9am, cfg)).toBeNull();
});

test('buildSignals — window is active at 9am',  () => expect(buildSignals(makeJson(50, 40, 0), wed9am, cfg).window).toBe('active'));
test('buildSignals — window is bonus at 9pm',   () => expect(buildSignals(makeJson(50, 40, 0, wed9pm), wed9pm, cfg).window).toBe('bonus'));
test('buildSignals — window is sleep at 1am',   () => expect(buildSignals(makeJson(50, 40, 0, wed1am), wed1am, cfg).window).toBe('sleep'));

test('buildSignals — allWeekly.pct reflects raw utilization', () => {
  const s = buildSignals(makeJson(55, 35, 0), wed9am, cfg);
  expect(s.allWeekly.pct).toBe(55);
  expect(s.sonnetWeekly.pct).toBe(35);
});

test('buildSignals — high allWeekly usage gives over severity', () => {
  const s = buildSignals(makeJson(80, 30, 0), wed9am, cfg);
  expect(s.allWeekly.sev).toBe('over');
  expect(s.allWeekly.dp).toBeGreaterThan(0);
});

test('buildSignals — low sonnet usage gives under severity', () => {
  const s = buildSignals(makeJson(50, 5, 0), wed9am, cfg);
  expect(s.sonnetWeekly.sev).toBe('under');
  expect(s.sonnetWeekly.dp).toBeLessThan(0);
});

test('buildSignals — resetInH is positive and under 168', () => {
  const s = buildSignals(makeJson(50, 40, 0), wed9am, cfg);
  expect(s.resetInH).toBeGreaterThan(0);
  expect(s.resetInH).toBeLessThan(168);
});

// ── classifySituation ─────────────────────────────────────────────────────────

test('classifySituation — ALL_CLEAR when all neutral', () => {
  expect(classifySituation(makeSignals(), cfg).key).toBe('ALL_CLEAR');
});

test('classifySituation — CRITICAL_LIMIT when allWeekly pct > 90', () => {
  const { key, params } = classifySituation(makeSignals({ allWPct: 92, allWDP: 60 }), cfg);
  expect(key).toBe('CRITICAL_LIMIT');
  expect(params.model).toBe('All-models');
  expect(params.pct).toBe(92);
});

test('classifySituation — CRITICAL_LIMIT prefers Sonnet when sonnet pct > 90', () => {
  const { key, params } = classifySituation(makeSignals({ allWPct: 70, sonWPct: 95, sonWDP: 60 }), cfg);
  expect(key).toBe('CRITICAL_LIMIT');
  expect(params.model).toBe('Sonnet');
});

test('classifySituation — RESET_TIGHT when resetInH < 4 and usage high', () => {
  expect(classifySituation(makeSignals({ resetInH: 2, allWPct: 80, allWDP: 40 }), cfg).key).toBe('RESET_TIGHT');
});

test('classifySituation — RESET_OPPORTUNITY when resetInH < 4 and both weeklies < 40%', () => {
  const { key, params } = classifySituation(makeSignals({ resetInH: 3, allWPct: 30, sonWPct: 25 }), cfg);
  expect(key).toBe('RESET_OPPORTUNITY');
  expect(params.pctLeft).toBe(70);
});

test('classifySituation — SLEEP',               () => expect(classifySituation(makeSignals({ win: 'sleep' }), cfg).key).toBe('SLEEP'));
test('classifySituation — BONUS_CATCH_UP',       () => expect(classifySituation(makeSignals({ win: 'bonus', allDDP: -5 }), cfg).key).toBe('BONUS_CATCH_UP'));
test('classifySituation — BONUS_OK',             () => expect(classifySituation(makeSignals({ win: 'bonus' }), cfg).key).toBe('BONUS_OK'));
test('classifySituation — BOTH_WEEKLY_OVER',     () => expect(classifySituation(makeSignals({ allWDP: 10, sonWDP: 8 }), cfg).key).toBe('BOTH_WEEKLY_OVER'));
test('classifySituation — WEEKLY_OVER_CORRECTING all-models', () => expect(classifySituation(makeSignals({ allWDP: 8, allDDP: -5 }), cfg).key).toBe('WEEKLY_OVER_CORRECTING'));
test('classifySituation — WEEKLY_OVER_CORRECTING Sonnet',     () => expect(classifySituation(makeSignals({ sonWDP: 8, sonDDP: -5 }), cfg).key).toBe('WEEKLY_OVER_CORRECTING'));
test('classifySituation — ALL_OVER_SONNET_UNDER', () => expect(classifySituation(makeSignals({ allWDP: 8, sonWDP: -5 }), cfg).key).toBe('ALL_OVER_SONNET_UNDER'));
test('classifySituation — ALL_OVER',             () => expect(classifySituation(makeSignals({ allWDP: 8 }), cfg).key).toBe('ALL_OVER'));
test('classifySituation — SONNET_OVER',          () => expect(classifySituation(makeSignals({ sonWDP: 8 }), cfg).key).toBe('SONNET_OVER'));
test('classifySituation — SESSION_HOT_WEEKLY_SLACK', () => expect(classifySituation(makeSignals({ sessDP: 12, allWDP: -8, sonWDP: -6 }), cfg).key).toBe('SESSION_HOT_WEEKLY_SLACK'));
test('classifySituation — SESSION_HOT_DAILY_SLOW',   () => expect(classifySituation(makeSignals({ sessDP: 12, allDDP: -5 }), cfg).key).toBe('SESSION_HOT_DAILY_SLOW'));
test('classifySituation — SESSION_HOT',          () => expect(classifySituation(makeSignals({ sessDP: 12 }), cfg).key).toBe('SESSION_HOT'));
test('classifySituation — WEEKLY_UNDER_RECOVERING all-models', () => expect(classifySituation(makeSignals({ allWDP: -8, allDDP: 5 }), cfg).key).toBe('WEEKLY_UNDER_RECOVERING'));
test('classifySituation — BOTH_WEEKLY_UNDER',    () => expect(classifySituation(makeSignals({ allWDP: -8, sonWDP: -6 }), cfg).key).toBe('BOTH_WEEKLY_UNDER'));
test('classifySituation — DAILY_BEHIND',         () => expect(classifySituation(makeSignals({ allDDP: -5 }), cfg).key).toBe('DAILY_BEHIND'));
test('classifySituation — DAILY_OK_WEEKLY_LAGGING', () => expect(classifySituation(makeSignals({ allWDP: -5 }), cfg).key).toBe('DAILY_OK_WEEKLY_LAGGING'));
test('classifySituation — SONNET_LIGHT',         () => expect(classifySituation(makeSignals({ sonWDP: -5 }), cfg).key).toBe('SONNET_LIGHT'));

// ── SITUATION_MESSAGES ────────────────────────────────────────────────────────

test('SITUATION_MESSAGES — ALL_CLEAR returns a non-empty string', () => {
  expect(SITUATION_MESSAGES.ALL_CLEAR({}).length).toBeGreaterThan(0);
});

test('SITUATION_MESSAGES — SONNET_OVER recommends Opus or Haiku', () => {
  const msg = SITUATION_MESSAGES.SONNET_OVER({ sonWDp: 6 });
  expect(msg).toContain('Opus');
  expect(msg).toContain('Haiku');
});

test('SITUATION_MESSAGES — every key is a function', () => {
  for (const [k, fn] of Object.entries(SITUATION_MESSAGES)) {
    expect(typeof fn, `${k} should be a function`).toBe('function');
  }
});
