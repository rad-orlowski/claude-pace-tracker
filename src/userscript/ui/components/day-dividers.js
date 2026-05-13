export const DAY_DIV_CLASS = '__claude-pace-day-div';

export function ensureDayDividers(host, days) {
  host.querySelectorAll('.' + DAY_DIV_CLASS).forEach(n => n.remove());
  for (let i = 1; i < days; i++) {
    const div = document.createElement('div');
    div.className = DAY_DIV_CLASS;
    Object.assign(div.style, {
      position: 'absolute', top: '-3px', bottom: '-3px',
      left: (i / days * 100).toFixed(3) + '%',
      width: '1px', transform: 'translateX(-0.5px)',
      background: 'rgba(255,255,255,0.18)',
      pointerEvents: 'none', zIndex: '1',
    });
    host.appendChild(div);
  }
}
