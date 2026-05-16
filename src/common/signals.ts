import { timeWindowOf, activeElapsedPctOf, todayEndExpectedPctOf, deltaPpOf, severityOf, signedPp } from './math.js';

export type Severity   = 'over' | 'under' | 'neutral';
export type TimeWindow = 'active' | 'bonus' | 'sleep';

export interface SignalsCfg {
  activeStartH: number;
  activeEndH:   number;
  sleepStartH:  number;
  bandWeekly:   number;
  bandSession:  number;
}

export interface Signals {
  session:       { dp: number; sev: Severity };
  allWeekly:     { dp: number; sev: Severity; pct: number };
  allDaily:      { dp: number; sev: Severity };
  sonnetWeekly:  { dp: number; sev: Severity; pct: number };
  sonnetDaily:   { dp: number; sev: Severity };
  window:        TimeWindow;
  resetInH:      number;
  daysLeft:      number;
}

export const SITUATION_MESSAGES: Record<string, (p: any) => string> = {
  CRITICAL_LIMIT:          (p) => `${p.model} weekly limit at ${p.pct}% — nearly exhausted. Minimise token use.`,
  RESET_TIGHT:             (p) => `Reset in ${p.resetInH}h with ${p.pct}% used. Tight — wrap up heavy tasks or wait for the reset.`,
  RESET_OPPORTUNITY:       (p) => `Reset in ${p.resetInH}h — ${p.pctLeft}% of quota unused. Good time to front-load heavy Sonnet work.`,
  SLEEP:                   (p) => `Resting. End-of-day: all-models ${p.allWDp}, Sonnet ${p.sonWDp}.`,
  BONUS_CATCH_UP:          (p) => `Past active hours but ${p.dayDp}% short of today's target. Bonus window — close the gap if you can.`,
  BONUS_OK:                (p) => `Daily target hit. Weekly at ${p.allWDp} — you're on track. Keep coding if you have work, or stop for the day.`,
  BOTH_WEEKLY_OVER:        (p) => `Both weekly limits running hot — all-models +${p.allWDp}%, Sonnet +${p.sonWDp}%. Ease off to preserve quota.`,
  WEEKLY_OVER_CORRECTING:  (p) => `Weekly ${p.model} is +${p.wDp}% ahead but today is light — naturally self-correcting. Keep this daily pace.`,
  ALL_OVER_SONNET_UNDER:   (p) => `Overall usage is high (+${p.allWDp}%) but Sonnet is underused. Prefer Sonnet for remaining work to get more value from it.`,
  ALL_OVER:                (p) => `All-models weekly is +${p.allWDp}% ahead. Sonnet quota is fine — shift to Sonnet-heavy tasks to slow the overall burn.`,
  SONNET_OVER:             (p) => `Sonnet weekly is +${p.sonWDp}% ahead. Switch to Opus or Haiku to preserve Sonnet quota.`,
  SESSION_HOT_WEEKLY_SLACK:(p) => `Hot session (+${p.sessDp}%) but weekly is conserved (${p.allWDp}% under). Budget available — keep the pace.`,
  SESSION_HOT_DAILY_SLOW:  (p) => `This session is hot (+${p.sessDp}%) but today's overall is still under target — slow start, active now. No concern yet.`,
  SESSION_HOT:             (p) => `Session is running hot (+${p.sessDp}%). Weekly budget is healthy — but watch if this pace continues.`,
  WEEKLY_UNDER_RECOVERING: (p) => `Behind on the week (${p.wDp}% under) but today is accelerating. Sustain this daily pace for ${p.daysLeft}d to catch up.`,
  BOTH_WEEKLY_UNDER:       (p) => `Weekly usage is light — all-models ${p.allWDp}% under, Sonnet ${p.sonWDp}% under. Good time for heavy tasks.`,
  DAILY_BEHIND:            (p) => `Behind today's target by ${p.dayDp}%. Push before ${p.activeEndH}:00 to stay on the weekly curve.`,
  DAILY_OK_WEEKLY_LAGGING: (p) => `Today looks fine but the week is light (${p.allWDp}% under). Sustain this daily pace to stay on track.`,
  SONNET_LIGHT:            (p) => `Sonnet weekly is light (${p.sonWDp}% under). Prefer Sonnet for quality-critical tasks — you have the headroom.`,
  ALL_CLEAR:               ()  => `All pace indicators on track. Keep going.`,
};

export function buildSignals(json: any, now: number, cfg: SignalsCfg): Signals | null {
  const allB    = json && json.seven_day;
  const sonB    = json && json.seven_day_sonnet;
  const sessB   = json && json.five_hour;
  if (!allB  || allB.utilization  == null || !allB.resets_at)  return null;
  if (!sonB  || sonB.utilization  == null || !sonB.resets_at)  return null;
  if (!sessB || sessB.utilization == null || !sessB.resets_at) return null;

  const wMs   = 7 * 24 * 60 * 60 * 1000;
  const sMs   = 5 * 60 * 60 * 1000;
  const allRA  = Date.parse(allB.resets_at);
  const sonRA  = Date.parse(sonB.resets_at);
  const sessRA = Date.parse(sessB.resets_at);
  if (!Number.isFinite(allRA) || !Number.isFinite(sonRA) || !Number.isFinite(sessRA)) return null;

  const bW = cfg.bandWeekly;
  const bS = cfg.bandSession;

  const allWElapsed  = activeElapsedPctOf(now, allRA,  wMs, cfg.activeStartH, cfg.activeEndH);
  const sonWElapsed  = activeElapsedPctOf(now, sonRA,  wMs, cfg.activeStartH, cfg.activeEndH);
  const sessElapsed  = activeElapsedPctOf(now, sessRA, sMs, cfg.activeStartH, cfg.activeEndH);

  const allWDp   = deltaPpOf(allB.utilization,  allWElapsed);
  const sonWDp   = deltaPpOf(sonB.utilization,  sonWElapsed);
  const sessDp   = deltaPpOf(sessB.utilization, sessElapsed);

  const allTodayExp = todayEndExpectedPctOf(now, allRA, wMs, cfg.activeEndH);
  const sonTodayExp = todayEndExpectedPctOf(now, sonRA, wMs, cfg.activeEndH);
  const allDDp  = deltaPpOf(allB.utilization, allTodayExp);
  const sonDDp  = deltaPpOf(sonB.utilization, sonTodayExp);

  const resetInMs = Math.min(allRA, sonRA) - now;
  const resetInH  = Math.max(0, resetInMs / 3600000);
  const daysLeft  = Math.ceil(resetInMs / (24 * 3600000));

  const win = timeWindowOf(new Date(now), cfg.activeStartH, cfg.activeEndH, cfg.sleepStartH);

  return {
    session:      { dp: sessDp,  sev: severityOf(sessDp,  bS) },
    allWeekly:    { dp: allWDp,  sev: severityOf(allWDp,  bW), pct: allB.utilization },
    allDaily:     { dp: allDDp,  sev: severityOf(allDDp,  bW) },
    sonnetWeekly: { dp: sonWDp,  sev: severityOf(sonWDp,  bW), pct: sonB.utilization },
    sonnetDaily:  { dp: sonDDp,  sev: severityOf(sonDDp,  bW) },
    window: win,
    resetInH,
    daysLeft,
  };
}

export function classifySituation(signals: Signals, cfg: SignalsCfg & { activeEndH: number }): { key: string; params: Record<string, any> } {
  const { session, allWeekly, allDaily, sonnetWeekly, sonnetDaily, window: win, resetInH, daysLeft } = signals;

  if (allWeekly.pct > 90)    return { key: 'CRITICAL_LIMIT', params: { model: 'All-models', pct: Math.round(allWeekly.pct) } };
  if (sonnetWeekly.pct > 90) return { key: 'CRITICAL_LIMIT', params: { model: 'Sonnet',     pct: Math.round(sonnetWeekly.pct) } };

  if (resetInH < 4 && (allWeekly.pct > 75 || sonnetWeekly.pct > 75))
    return { key: 'RESET_TIGHT', params: {
      resetInH: resetInH.toFixed(1),
      pct: Math.round(Math.max(allWeekly.pct, sonnetWeekly.pct)),
    }};

  if (resetInH < 4 && allWeekly.pct < 40 && sonnetWeekly.pct < 40)
    return { key: 'RESET_OPPORTUNITY', params: {
      resetInH: resetInH.toFixed(1),
      pctLeft: Math.round(100 - allWeekly.pct),
    }};

  if (win === 'sleep')
    return { key: 'SLEEP', params: {
      allWDp: signedPp(allWeekly.dp),
      sonWDp: signedPp(sonnetWeekly.dp),
    }};

  if (win === 'bonus' && (allDaily.sev === 'under' || sonnetDaily.sev === 'under')) {
    const dayDp = Math.round(Math.abs(Math.min(allDaily.dp, sonnetDaily.dp)));
    return { key: 'BONUS_CATCH_UP', params: { dayDp } };
  }

  if (win === 'bonus') {
    if (allWeekly.sev === 'over' && sonnetWeekly.sev === 'over')
      return { key: 'BOTH_WEEKLY_OVER', params: { allWDp: Math.round(allWeekly.dp), sonWDp: Math.round(sonnetWeekly.dp) } };
    if (allWeekly.sev === 'over' && sonnetWeekly.sev === 'under')
      return { key: 'ALL_OVER_SONNET_UNDER', params: { allWDp: Math.round(allWeekly.dp) } };
    if (allWeekly.sev === 'over')
      return { key: 'ALL_OVER', params: { allWDp: Math.round(allWeekly.dp) } };
    if (sonnetWeekly.sev === 'over')
      return { key: 'SONNET_OVER', params: { sonWDp: Math.round(sonnetWeekly.dp) } };
    return { key: 'BONUS_OK', params: { allWDp: signedPp(allWeekly.dp) } };
  }

  if (allWeekly.sev === 'over' && sonnetWeekly.sev === 'over')
    return { key: 'BOTH_WEEKLY_OVER', params: {
      allWDp: Math.round(allWeekly.dp),
      sonWDp: Math.round(sonnetWeekly.dp),
    }};

  if (allWeekly.sev === 'over' && allDaily.sev === 'under')
    return { key: 'WEEKLY_OVER_CORRECTING', params: { model: 'all-models', wDp: Math.round(allWeekly.dp) } };
  if (sonnetWeekly.sev === 'over' && sonnetDaily.sev === 'under')
    return { key: 'WEEKLY_OVER_CORRECTING', params: { model: 'Sonnet', wDp: Math.round(sonnetWeekly.dp) } };

  if (allWeekly.sev === 'over' && sonnetWeekly.sev === 'under')
    return { key: 'ALL_OVER_SONNET_UNDER', params: { allWDp: Math.round(allWeekly.dp) } };

  if (allWeekly.sev === 'over')
    return { key: 'ALL_OVER', params: { allWDp: Math.round(allWeekly.dp) } };

  if (sonnetWeekly.sev === 'over')
    return { key: 'SONNET_OVER', params: { sonWDp: Math.round(sonnetWeekly.dp) } };

  if (session.sev === 'over' && allWeekly.sev === 'under' && sonnetWeekly.sev === 'under')
    return { key: 'SESSION_HOT_WEEKLY_SLACK', params: {
      sessDp: Math.round(session.dp),
      allWDp: Math.round(Math.abs(allWeekly.dp)),
    }};

  if (session.sev === 'over' && (allDaily.sev === 'under' || sonnetDaily.sev === 'under'))
    return { key: 'SESSION_HOT_DAILY_SLOW', params: { sessDp: Math.round(session.dp) } };

  if (session.dp > cfg.bandSession * 2)
    return { key: 'SESSION_HOT', params: { sessDp: Math.round(session.dp) } };

  if (allWeekly.sev === 'under' && allDaily.sev === 'over')
    return { key: 'WEEKLY_UNDER_RECOVERING', params: {
      model: 'all-models', wDp: Math.round(Math.abs(allWeekly.dp)), daysLeft,
    }};
  if (sonnetWeekly.sev === 'under' && sonnetDaily.sev === 'over')
    return { key: 'WEEKLY_UNDER_RECOVERING', params: {
      model: 'Sonnet', wDp: Math.round(Math.abs(sonnetWeekly.dp)), daysLeft,
    }};

  if (allWeekly.sev === 'under' && sonnetWeekly.sev === 'under')
    return { key: 'BOTH_WEEKLY_UNDER', params: {
      allWDp: Math.round(Math.abs(allWeekly.dp)),
      sonWDp: Math.round(Math.abs(sonnetWeekly.dp)),
    }};

  if (allDaily.sev === 'under' || sonnetDaily.sev === 'under') {
    const dayDp = Math.round(Math.abs(Math.min(allDaily.dp, sonnetDaily.dp)));
    return { key: 'DAILY_BEHIND', params: { dayDp, activeEndH: cfg.activeEndH } };
  }

  if (allWeekly.sev === 'under')
    return { key: 'DAILY_OK_WEEKLY_LAGGING', params: { allWDp: Math.round(Math.abs(allWeekly.dp)) } };

  if (sonnetWeekly.sev === 'under')
    return { key: 'SONNET_LIGHT', params: { sonWDp: Math.round(Math.abs(sonnetWeekly.dp)) } };

  return { key: 'ALL_CLEAR', params: {} };
}

export function resolveSituation(signals: Signals, cfg: SignalsCfg): string {
  const { key, params } = classifySituation(signals, cfg);
  return SITUATION_MESSAGES[key]?.(params) ?? key;
}
