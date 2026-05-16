import { buildSignals, classifySituation, SITUATION_MESSAGES } from './signals.js';
import { activeElapsedPctOf } from './math.js';

function trendOf(severity, window) {
  if (window === 'sleep') return 'sleep';
  if (severity === 'over')    return 'over';
  if (severity === 'under')   return 'under';
  return 'on-track';
}

export function buildPushPayload(json, nowMs, cfg) {
  if (!json || typeof json !== 'object') return null;
  const signals = buildSignals(json, nowMs, cfg);
  if (!signals) return null;

  const allRA  = Date.parse(json.seven_day.resets_at);
  const sonRA  = Date.parse(json.seven_day_sonnet.resets_at);
  const sessRA = Date.parse(json.five_hour.resets_at);
  const wMs = 7 * 24 * 3600 * 1000;
  const sMs = 5 * 3600 * 1000;

  const allWElapsed = activeElapsedPctOf(nowMs, allRA,  wMs, cfg.activeStartH, cfg.activeEndH);
  const sonWElapsed = activeElapsedPctOf(nowMs, sonRA,  wMs, cfg.activeStartH, cfg.activeEndH);
  const sessElapsed = activeElapsedPctOf(nowMs, sessRA, sMs, cfg.activeStartH, cfg.activeEndH);

  const { key, params } = classifySituation(signals, cfg);
  const message = (SITUATION_MESSAGES[key] || (() => key))(params);

  const win = signals.window;
  return {
    schemaVersion: 1,
    pushedAt: new Date(nowMs).toISOString(),
    raw: {
      seven_day:        { utilization: json.seven_day.utilization,        resets_at: json.seven_day.resets_at },
      seven_day_sonnet: { utilization: json.seven_day_sonnet.utilization, resets_at: json.seven_day_sonnet.resets_at },
      seven_day_opus:   { utilization: json.seven_day_opus?.utilization ?? 0, resets_at: json.seven_day_opus?.resets_at ?? json.seven_day.resets_at },
      five_hour:        { utilization: json.five_hour.utilization,        resets_at: json.five_hour.resets_at },
    },
    computed: {
      window:   win,
      resetInH: signals.resetInH,
      daysLeft: signals.daysLeft,
      session:      { utilizationPct: signals.session.dp + sessElapsed, deltaPp: signals.session.dp,      elapsedPct: sessElapsed, trend: trendOf(signals.session.sev,      win) },
      allWeekly:    { utilizationPct: signals.allWeekly.pct,             deltaPp: signals.allWeekly.dp,    elapsedPct: allWElapsed, trend: trendOf(signals.allWeekly.sev,    win) },
      allDaily:     { deltaPp: signals.allDaily.dp,    trend: trendOf(signals.allDaily.sev,    win) },
      sonnetWeekly: { utilizationPct: signals.sonnetWeekly.pct,          deltaPp: signals.sonnetWeekly.dp, elapsedPct: sonWElapsed, trend: trendOf(signals.sonnetWeekly.sev, win) },
      sonnetDaily:  { deltaPp: signals.sonnetDaily.dp, trend: trendOf(signals.sonnetDaily.sev, win) },
      opusPct: signals.opusPct,
    },
    situation: { key, params, message, trend: trendOf(signals.allWeekly.sev, win) },
  };
}
