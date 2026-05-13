import { ACTIVE_START_H, ACTIVE_END_H, SLEEP_START_H, NEUTRAL_BAND_PP } from './constants.js';

export function timeWindowOf(
  date: Date,
  activeStartH = ACTIVE_START_H,
  activeEndH   = ACTIVE_END_H,
  sleepStartH  = SLEEP_START_H,
): 'active' | 'bonus' | 'sleep' {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= activeStartH && h < activeEndH)  return 'active';
  if (h >= activeEndH   && h < sleepStartH) return 'bonus';
  return 'sleep';
}

export function activeHoursBetween(
  startMs: number, endMs: number,
  activeStartH = ACTIVE_START_H, activeEndH = ACTIVE_END_H,
): number {
  if (endMs <= startMs) return 0;
  let total = 0;
  const d = new Date(startMs);
  d.setHours(0, 0, 0, 0);
  while (d.getTime() < endMs) {
    const lo = Math.max(d.getTime() + activeStartH * 3_600_000, startMs);
    const hi = Math.min(d.getTime() + activeEndH   * 3_600_000, endMs);
    if (hi > lo) total += hi - lo;
    d.setDate(d.getDate() + 1);
  }
  return total;
}

export function activeElapsedPctOf(
  nowMs: number, resetsAt: number, periodMs: number,
  activeStartH = ACTIVE_START_H, activeEndH = ACTIVE_END_H,
): number {
  const periodStart = resetsAt - periodMs;
  if (nowMs <= periodStart) return 0;
  const clampedNow  = Math.min(nowMs, resetsAt);
  const totalActive = activeHoursBetween(periodStart, resetsAt, activeStartH, activeEndH);
  if (totalActive <= 0) return 0;
  const elapsed = activeHoursBetween(periodStart, clampedNow, activeStartH, activeEndH);
  return (elapsed / totalActive) * 100;
}

export function frozenExpectedPctOf(
  nowMs: number, resetsAt: number, periodMs: number,
  activeStartH = ACTIVE_START_H, activeEndH = ACTIVE_END_H,
): number {
  const eod = new Date(nowMs);
  eod.setHours(activeEndH, 0, 0, 0);
  if (eod.getTime() > nowMs) eod.setDate(eod.getDate() - 1);
  return activeElapsedPctOf(eod.getTime(), resetsAt, periodMs, activeStartH, activeEndH);
}

export function todayEndExpectedPctOf(
  nowMs: number, resetsAtMs: number, periodMs: number,
  activeEndH = ACTIVE_END_H,
): number {
  const eod = new Date(nowMs);
  eod.setHours(activeEndH, 0, 0, 0);
  const targetMs = Math.min(eod.getTime(), resetsAtMs);
  return activeElapsedPctOf(targetMs, resetsAtMs, periodMs);
}

export function elapsedPctOf(now: number, resetsAt: number, periodMs: number): number {
  const periodStart = resetsAt - periodMs;
  const elapsedMs   = now - periodStart;
  if (elapsedMs <= 0)        return 0;
  if (elapsedMs >= periodMs) return 100;
  return (elapsedMs / periodMs) * 100;
}

export function deltaPpOf(usedPct: number, elapsedPct: number): number {
  return usedPct - elapsedPct;
}

export function severityOf(deltaPp: number, neutralBand = NEUTRAL_BAND_PP): 'over' | 'under' | 'neutral' {
  if (deltaPp >  neutralBand) return 'over';
  if (deltaPp < -neutralBand) return 'under';
  return 'neutral';
}

export function signedPp(dp: number): string {
  const n = Math.round(dp);
  return (n > 0 ? '+' : '') + n + '%';
}
