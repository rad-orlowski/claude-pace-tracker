import { ACTIVE_START_H, ACTIVE_END_H, SLEEP_START_H, NEUTRAL_BAND_PP } from './constants.js';

export function timeWindowOf(date, activeStartH = ACTIVE_START_H, activeEndH = ACTIVE_END_H, sleepStartH = SLEEP_START_H) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= activeStartH && h < activeEndH) return 'active';
  if (h >= activeEndH   && h < sleepStartH) return 'bonus';
  return 'sleep';
}

export function activeHoursBetween(startMs, endMs, activeStartH = ACTIVE_START_H, activeEndH = ACTIVE_END_H) {
  if (endMs <= startMs) return 0;
  let total = 0;
  const d = new Date(startMs);
  d.setHours(0, 0, 0, 0);
  while (d.getTime() < endMs) {
    const lo = Math.max(d.getTime() + activeStartH * 3600000, startMs);
    const hi = Math.min(d.getTime() + activeEndH   * 3600000, endMs);
    if (hi > lo) total += hi - lo;
    d.setDate(d.getDate() + 1);
  }
  return total;
}

export function activeElapsedPctOf(nowMs, resetsAt, periodMs, activeStartH = ACTIVE_START_H, activeEndH = ACTIVE_END_H) {
  const periodStart = resetsAt - periodMs;
  if (nowMs <= periodStart) return 0;
  const clampedNow  = Math.min(nowMs, resetsAt);
  const totalActive = activeHoursBetween(periodStart, resetsAt, activeStartH, activeEndH);
  if (totalActive <= 0) return 0;
  const elapsed = activeHoursBetween(periodStart, clampedNow, activeStartH, activeEndH);
  return (elapsed / totalActive) * 100;
}

export function frozenExpectedPctOf(nowMs, resetsAt, periodMs, activeStartH = ACTIVE_START_H, activeEndH = ACTIVE_END_H) {
  const eod = new Date(nowMs);
  eod.setHours(activeEndH, 0, 0, 0);
  if (eod.getTime() > nowMs) eod.setDate(eod.getDate() - 1);
  return activeElapsedPctOf(eod.getTime(), resetsAt, periodMs, activeStartH, activeEndH);
}

export function todayEndExpectedPctOf(nowMs, resetsAtMs, periodMs, activeEndH = ACTIVE_END_H) {
  const eod = new Date(nowMs);
  eod.setHours(activeEndH, 0, 0, 0);
  const targetMs = Math.min(eod.getTime(), resetsAtMs);
  return activeElapsedPctOf(targetMs, resetsAtMs, periodMs);
}

export function elapsedPctOf(now, resetsAt, periodMs) {
  const periodStart = resetsAt - periodMs;
  const elapsedMs = now - periodStart;
  if (elapsedMs <= 0) return 0;
  if (elapsedMs >= periodMs) return 100;
  return (elapsedMs / periodMs) * 100;
}

export function deltaPpOf(usedPct, elapsedPct) {
  return usedPct - elapsedPct;
}

export function severityOf(deltaPp, neutralBand = NEUTRAL_BAND_PP) {
  if (deltaPp >  neutralBand) return 'over';
  if (deltaPp < -neutralBand) return 'under';
  return 'neutral';
}

export function signedPp(dp) {
  const n = Math.round(dp);
  return (n > 0 ? '+' : '') + n + '%';
}
