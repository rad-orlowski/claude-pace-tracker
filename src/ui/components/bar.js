import { ACTIVE_START_H, ACTIVE_END_H, SLEEP_START_H } from '../../constants.js';

export const BAR_COLORS = {
  active:    '#5c7dd6',
  activeAlt: '#4a6bbf',
  bonus:     '#b8931e',
  sleep:     '#454f65',
};

const MASK_CLASS = '__claude-pace-mask';

export function buildBarGradient(periodStartMs, periodMs,
    activeStartH = ACTIVE_START_H, activeEndH = ACTIVE_END_H, sleepStartH = SLEEP_START_H) {
  const stops = [];
  const periodEnd = periodStartMs + periodMs;
  const cursor = new Date(periodStartMs);
  cursor.setHours(0, 0, 0, 0);

  while (cursor.getTime() < periodEnd) {
    const day = cursor.getTime();
    const windows = [
      { start: day,                            end: day + activeStartH * 3600000, color: BAR_COLORS.sleep  },
      { start: day + activeStartH * 3600000,   end: day + activeEndH   * 3600000, color: BAR_COLORS.active },
      { start: day + activeEndH   * 3600000,   end: day + sleepStartH  * 3600000, color: BAR_COLORS.bonus  },
      { start: day + sleepStartH  * 3600000,   end: day + 24           * 3600000, color: BAR_COLORS.sleep  },
    ];
    for (const w of windows) {
      const lo = Math.max(w.start, periodStartMs);
      const hi = Math.min(w.end,   periodEnd);
      if (hi <= lo) continue;
      const pLo = ((lo - periodStartMs) / periodMs * 100).toFixed(3);
      const pHi = ((hi - periodStartMs) / periodMs * 100).toFixed(3);
      stops.push(`${w.color} ${pLo}%`);
      stops.push(`${w.color} ${pHi}%`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  let result = `linear-gradient(to right,${stops.join(',')})`;
  result = result.replace(/100\.000%\)/, '100%)');
  return result;
}

export function buildWeeklyBar(days = 7) {
  const segW = 100 / days;
  const colors = [BAR_COLORS.active, BAR_COLORS.activeAlt];
  const stops = [];
  for (let i = 0; i < days; i++) {
    const lo = (i * segW).toFixed(3);
    const hi = ((i + 1) * segW).toFixed(3);
    stops.push(`${colors[i % 2]} ${lo}%`, `${colors[i % 2]} ${hi}%`);
  }
  return `linear-gradient(to right,${stops.join(',')})`.replace('100.000%)', '100%)');
}

export function applyBarGradient(bar, periodStartMs, periodMs, usedPct, bucketKey) {
  bar.style.background = bucketKey === 'five_hour'
    ? buildBarGradient(periodStartMs, periodMs)
    : buildWeeklyBar();
  bar.style.border = 'none';
  const fill = bar.querySelector('div');
  if (fill) fill.style.background = 'transparent';
  if (getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
  let mask = bar.querySelector('.' + MASK_CLASS);
  if (!mask) {
    mask = document.createElement('div');
    mask.className = MASK_CLASS;
    Object.assign(mask.style, {
      position: 'absolute', top: '0', bottom: '0', right: '0',
      background: 'rgba(0,0,0,0.62)', pointerEvents: 'none', zIndex: '1',
    });
    bar.appendChild(mask);
  }
  mask.style.left = usedPct.toFixed(2) + '%';
  mask.style.borderRadius = usedPct <= 1 ? '4px' : '0 4px 4px 0';
}
